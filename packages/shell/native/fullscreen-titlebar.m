// The traffic lights of a fullscreen macOS window, the way a native app with a toolbar shows them: they fade in over
// the page at the place they have outside fullscreen when the menu bar comes down, without a title bar strip.
//
// Without a toolbar AppKit slides a title bar strip down over the page instead. With one, the strip stays put and
// only the buttons fade in. So the window gets an empty toolbar while it is fullscreen, and the strip that holds it
// is made see-through and lets clicks through to the page, except over the lights while they show. On a display
// without a notch the strip still comes down with the menu bar; how far is reported each frame, so the page can
// move its top bar along.
#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#import <objc/runtime.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

// The Node-API calls this module makes, declared here so it builds with clang alone. Node-API is ABI-stable, and
// Electron's main process provides the symbols at load time.
typedef struct napi_env__ *napi_env;
typedef struct napi_value__ *napi_value;
typedef struct napi_callback_info__ *napi_callback_info;
typedef struct napi_threadsafe_function__ *napi_threadsafe_function;
typedef int napi_status;
typedef napi_value (*napi_callback)(napi_env env, napi_callback_info info);
typedef void (*napi_finalize)(napi_env env, void *data, void *hint);
typedef void (*napi_threadsafe_function_call_js)(napi_env env, napi_value callback, void *context, void *data);

static const napi_status NAPI_OK = 0;
static const int NAPI_TSFN_RELEASE = 0;
static const int NAPI_TSFN_NONBLOCKING = 0;

extern napi_status napi_get_cb_info(napi_env env, napi_callback_info info, size_t *argc, napi_value *argv, napi_value *self, void **data);
extern napi_status napi_get_buffer_info(napi_env env, napi_value value, void **data, size_t *length);
extern napi_status napi_get_boolean(napi_env env, bool value, napi_value *result);
extern napi_status napi_create_double(napi_env env, double value, napi_value *result);
extern napi_status napi_get_undefined(napi_env env, napi_value *result);
extern napi_status napi_create_string_utf8(napi_env env, const char *text, size_t length, napi_value *result);
extern napi_status napi_call_function(napi_env env, napi_value self, napi_value function, size_t argc, const napi_value *argv, napi_value *result);
extern napi_status napi_create_function(napi_env env, const char *name, size_t length, napi_callback callback, void *data, napi_value *result);
extern napi_status napi_set_named_property(napi_env env, napi_value object, const char *name, napi_value value);
extern napi_status napi_create_threadsafe_function(napi_env env, napi_value function, napi_value resource, napi_value resourceName, size_t maxQueueSize, size_t threadCount, void *finalizeData, napi_finalize finalize, void *context, napi_threadsafe_function_call_js callJs, napi_threadsafe_function *result);
extern napi_status napi_call_threadsafe_function(napi_threadsafe_function function, void *data, int mode);
extern napi_status napi_release_threadsafe_function(napi_threadsafe_function function, int mode);
extern napi_status napi_unref_threadsafe_function(napi_env env, napi_threadsafe_function function);

typedef struct {
    bool revealed;
    double offset;
} Report;

static void callReport(napi_env env, napi_value callback, void *context, void *data) {
    Report *report = data;

    if (env != NULL && callback != NULL) {
        napi_value argv[2];
        napi_value undefined;
        napi_get_boolean(env, report->revealed, &argv[0]);
        napi_create_double(env, report->offset, &argv[1]);
        napi_get_undefined(env, &undefined);
        napi_call_function(env, undefined, callback, 2, argv, NULL);
    }

    free(report);
}

static NSArray<NSNumber *> *buttonKinds(void) {
    return @[@(NSWindowCloseButton), @(NSWindowMiniaturizeButton), @(NSWindowZoomButton)];
}

@interface ADEFullScreenTitlebar : NSObject
- (instancetype)initWithWindow:(NSWindow *)window report:(napi_threadsafe_function)report;
@end

@implementation ADEFullScreenTitlebar {
    __weak NSWindow *_window;
    napi_threadsafe_function _report;
    NSMutableArray *_observers;
    // Each button's top-left outside fullscreen, measured from the top-left of the title bar.
    NSPoint _windowed[3];
    BOOL _addedToolbar;
    BOOL _following;
    BOOL _revealed;
    double _offset;
    BOOL _placePending;
    NSButton *_watchedClose;
    id _mouseMonitor;
    id _frameObserver;
    CADisplayLink *_frameLink;
}

- (instancetype)initWithWindow:(NSWindow *)window report:(napi_threadsafe_function)report {
    self = [super init];

    if (self) {
        _window = window;
        _report = report;
        _observers = [NSMutableArray array];
        NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
        __weak ADEFullScreenTitlebar *weakSelf = self;
        [_observers addObject:[center addObserverForName:NSWindowWillEnterFullScreenNotification object:window queue:nil usingBlock:^(NSNotification *note) {
            [weakSelf willEnter];
        }]];
        [_observers addObject:[center addObserverForName:NSWindowDidEnterFullScreenNotification object:window queue:nil usingBlock:^(NSNotification *note) {
            [weakSelf didEnter];
        }]];
        [_observers addObject:[center addObserverForName:NSWindowWillExitFullScreenNotification object:window queue:nil usingBlock:^(NSNotification *note) {
            [weakSelf stopFollowing];
        }]];
        [_observers addObject:[center addObserverForName:NSWindowDidExitFullScreenNotification object:window queue:nil usingBlock:^(NSNotification *note) {
            [weakSelf didExit];
        }]];
        [_observers addObject:[center addObserverForName:NSWindowWillCloseNotification object:window queue:nil usingBlock:^(NSNotification *note) {
            [weakSelf close];
        }]];
        // Electron shows the title and an opaque title bar again in fullscreen, after the window got there.
        [window addObserver:self forKeyPath:@"titleVisibility" options:0 context:NULL];
        [window addObserver:self forKeyPath:@"titlebarAppearsTransparent" options:0 context:NULL];
    }

    return self;
}

- (void)send {
    if (_report == NULL) {
        return;
    }

    Report *report = malloc(sizeof(Report));
    report->revealed = _revealed;
    report->offset = _offset;
    napi_call_threadsafe_function(_report, report, NAPI_TSFN_NONBLOCKING);
}

- (NSButton *)button:(NSUInteger)index {
    return [_window standardWindowButton:(NSWindowButton)buttonKinds()[index].integerValue];
}

- (void)willEnter {
    for (NSUInteger i = 0; i < 3; i++) {
        NSButton *button = [self button:i];
        _windowed[i] = NSMakePoint(button.frame.origin.x, button.superview.frame.size.height - NSMaxY(button.frame));
    }

    // Only a window with a toolbar keeps its strip in place in fullscreen and fades the lights in. Outside
    // fullscreen a toolbar would round the window's corners further, so it is there only while fullscreen.
    if (_window.toolbar == nil) {
        NSToolbar *toolbar = [[NSToolbar alloc] initWithIdentifier:@"adecore.fullscreen-titlebar"];
        toolbar.showsBaselineSeparator = NO;
        _window.toolbar = toolbar;
        _window.toolbarStyle = NSWindowToolbarStyleUnified;
        _addedToolbar = YES;
    }
}

- (void)didEnter {
    NSWindow *window = _window;
    NSButton *close = [self button:0];
    NSWindow *strip = close.window;

    if (window == nil || strip == nil || strip == window) {
        return;
    }

    // The page keeps the whole screen; the strip lies over it instead of pushing it down.
    window.styleMask |= NSWindowStyleMaskFullSizeContentView;
    window.titlebarAppearsTransparent = YES;
    window.titleVisibility = NSWindowTitleHidden;
    strip.opaque = NO;
    strip.backgroundColor = NSColor.clearColor;
    strip.ignoresMouseEvents = YES;
    [self setStripVisible:NO];
    [self placeLights];

    for (NSUInteger i = 0; i < 3; i++) {
        [self button:i].postsFrameChangedNotifications = YES;
    }

    __weak ADEFullScreenTitlebar *weakSelf = self;
    // AppKit lays the lights out again each time they show; they go back to their place before the next frame.
    _frameObserver = [NSNotificationCenter.defaultCenter addObserverForName:NSViewFrameDidChangeNotification object:nil queue:nil usingBlock:^(NSNotification *note) {
        NSView *view = note.object;

        if (view.window == strip && [view isKindOfClass:[NSButton class]]) {
            [weakSelf placeLightsSoon];
        }
    }];
    // Clicks go to the page unless the pointer is over the lights while they show.
    _mouseMonitor = [NSEvent addLocalMonitorForEventsMatchingMask:NSEventMaskMouseMoved | NSEventMaskLeftMouseDragged handler:^NSEvent *(NSEvent *event) {
        [weakSelf updateClickThrough];
        return event;
    }];
    _watchedClose = close;
    [close addObserver:self forKeyPath:@"alphaValue" options:0 context:NULL];
    _following = YES;
}

- (void)stopFollowing {
    if (!_following) {
        return;
    }

    _following = NO;
    [_watchedClose removeObserver:self forKeyPath:@"alphaValue"];
    _watchedClose = nil;
    [_frameLink invalidate];
    _frameLink = nil;

    if (_mouseMonitor != nil) {
        [NSEvent removeMonitor:_mouseMonitor];
        _mouseMonitor = nil;
    }

    if (_frameObserver != nil) {
        [NSNotificationCenter.defaultCenter removeObserver:_frameObserver];
        _frameObserver = nil;
    }

    if (_revealed || _offset != 0) {
        _revealed = NO;
        _offset = 0;
        [self send];
    }
}

- (void)didExit {
    // The title bar's parts are the window's own again, so they show as they did before.
    [self setStripVisible:YES];

    if (_addedToolbar) {
        _window.toolbar = nil;
        _addedToolbar = NO;
    }

    // Taking the toolbar away lays the lights out again after the app placed them, so they go back by hand.
    __weak ADEFullScreenTitlebar *weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{
        [weakSelf placeLights];
    });
}

- (void)close {
    [self stopFollowing];

    for (id observer in _observers) {
        [NSNotificationCenter.defaultCenter removeObserver:observer];
    }

    [_observers removeAllObjects];
    [_window removeObserver:self forKeyPath:@"titleVisibility"];
    [_window removeObserver:self forKeyPath:@"titlebarAppearsTransparent"];

    if (_report != NULL) {
        napi_release_threadsafe_function(_report, NAPI_TSFN_RELEASE);
        _report = NULL;
    }

    if (_window != nil) {
        objc_setAssociatedObject(_window, @selector(close), nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    }
}

- (void)setStripVisible:(BOOL)visible {
    NSView *titlebar = [self button:0].superview;
    NSView *container = titlebar.superview;
    CGFloat alpha = visible ? 1 : 0;

    // Beside the lights the container holds the strip's background and its border.
    for (NSView *part in container.subviews) {
        if (part != titlebar) {
            part.alphaValue = alpha;
        }
    }

    for (NSView *part in titlebar.subviews) {
        // The window's title, in the title bar or in the toolbar's title view.
        if ([part isKindOfClass:[NSTextField class]]) {
            part.alphaValue = alpha;
        }

        if ([NSStringFromClass([part class]) isEqualToString:@"NSToolbarView"]) {
            for (NSView *inner in part.subviews) {
                if ([NSStringFromClass([inner class]) containsString:@"Title"]) {
                    inner.alphaValue = alpha;
                }
            }
        }
    }

    // The strip's own fill is a plain layer beside the container. AppKit unhides it on every reveal but leaves
    // its opacity alone.
    for (CALayer *layer in container.superview.layer.sublayers) {
        if ([layer class] == [CALayer class]) {
            layer.opacity = alpha;
        }
    }
}

- (void)placeLights {
    for (NSUInteger i = 0; i < 3; i++) {
        NSButton *button = [self button:i];
        CGFloat height = button.superview.frame.size.height;
        NSPoint origin = NSMakePoint(_windowed[i].x, height - _windowed[i].y - button.frame.size.height);

        if (!NSEqualPoints(button.frame.origin, origin)) {
            [button setFrameOrigin:origin];
        }
    }
}

- (void)placeLightsSoon {
    if (_placePending) {
        return;
    }

    _placePending = YES;
    __weak ADEFullScreenTitlebar *weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{
        ADEFullScreenTitlebar *strongSelf = weakSelf;

        if (strongSelf == nil) {
            return;
        }

        strongSelf->_placePending = NO;

        if (strongSelf->_following) {
            [strongSelf placeLights];
        }
    });
}

- (void)updateClickThrough {
    NSButton *close = [self button:0];
    NSButton *zoom = [self button:2];
    NSWindow *strip = close.window;

    if (!_following || strip == nil || strip == _window) {
        return;
    }

    NSRect lights = NSInsetRect(NSUnionRect(close.frame, zoom.frame), -6, -6);
    NSRect onScreen = [strip convertRectToScreen:[close.superview convertRect:lights toView:nil]];
    BOOL over = close.alphaValue > 0 && NSPointInRect(NSEvent.mouseLocation, onScreen);
    strip.ignoresMouseEvents = !over;
}

// How far the strip came down with the menu bar. At rest it lines up with the top of the fullscreen window, which
// sits below a notch where there is one, so there it stays 0.
- (double)stripOffset {
    NSWindow *strip = [self button:0].window;

    if (strip == nil || strip == _window) {
        return 0;
    }

    double rest = NSMaxY(_window.frame) - strip.frame.size.height;

    return round((rest - strip.frame.origin.y) * 2) / 2;
}

- (void)tick:(CADisplayLink *)link {
    double offset = [self stripOffset];

    if (offset != _offset) {
        _offset = offset;
        [self send];
    }

    [self updateClickThrough];

    if (!_revealed && offset == 0) {
        [_frameLink invalidate];
        _frameLink = nil;
    }
}

- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary *)change context:(void *)context {
    if (object == _window) {
        if (!_following) {
            return;
        }

        if (_window.titleVisibility != NSWindowTitleHidden) {
            _window.titleVisibility = NSWindowTitleHidden;
        }

        if (!_window.titlebarAppearsTransparent) {
            _window.titlebarAppearsTransparent = YES;
        }

        return;
    }

    if (!_following) {
        return;
    }

    // AppKit sets the alpha to 1 as the fade-in starts, and to 0 once the fade-out is over.
    BOOL shows = _watchedClose.alphaValue > 0;

    if (shows != _revealed) {
        _revealed = shows;
        [self send];
        [self updateClickThrough];
    }

    if (shows && _frameLink == nil) {
        // Follows the strip each frame while it comes down with the menu bar and goes back up.
        _frameLink = [_watchedClose.window.contentView displayLinkWithTarget:self selector:@selector(tick:)];
        [_frameLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    }
}

@end

static napi_value booleanOf(napi_env env, bool value) {
    napi_value result = NULL;
    napi_get_boolean(env, value, &result);

    return result;
}

// `attach(handle, report)`: `handle` is Electron's `getNativeWindowHandle()`, a buffer holding the window's
// `NSView *`; `report(revealed, offset)` hears each change. Answers whether the window was attached.
static napi_value attach(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value argv[2];
    void *data = NULL;
    size_t length = 0;

    if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != NAPI_OK || argc < 2) {
        return booleanOf(env, false);
    }

    if (napi_get_buffer_info(env, argv[0], &data, &length) != NAPI_OK || length < sizeof(void *)) {
        return booleanOf(env, false);
    }

    NSView *view = (__bridge NSView *)(*(void **)data);
    NSWindow *window = view.window;

    if (window == nil || [window standardWindowButton:NSWindowCloseButton] == nil) {
        return booleanOf(env, false);
    }

    if (objc_getAssociatedObject(window, @selector(close)) != nil) {
        return booleanOf(env, true);
    }

    napi_value name;
    napi_threadsafe_function report = NULL;
    napi_create_string_utf8(env, "fullscreen-titlebar", SIZE_MAX, &name);

    if (napi_create_threadsafe_function(env, argv[1], NULL, name, 0, 1, NULL, NULL, NULL, callReport, &report) != NAPI_OK) {
        return booleanOf(env, false);
    }

    // The window's lifetime, not this callback, decides how long the app runs.
    napi_unref_threadsafe_function(env, report);
    ADEFullScreenTitlebar *titlebar = [[ADEFullScreenTitlebar alloc] initWithWindow:window report:report];
    objc_setAssociatedObject(window, @selector(close), titlebar, OBJC_ASSOCIATION_RETAIN_NONATOMIC);

    return booleanOf(env, true);
}

__attribute__((visibility("default"))) int32_t node_api_module_get_api_version_v1(void) {
    return 8;
}

__attribute__((visibility("default"))) napi_value napi_register_module_v1(napi_env env, napi_value exports) {
    napi_value function = NULL;
    napi_create_function(env, "attach", SIZE_MAX, attach, NULL, &function);
    napi_set_named_property(env, exports, "attach", function);

    return exports;
}

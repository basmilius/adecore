<template>
    <div class="demo">
        <div
            class="demo-stage vp-raw"
            :class="{ 'demo-stage-fill': fill }">
            <div
                ref="host"
                class="demo-host"/>
        </div>
        <div class="demo-code">
            <slot/>
        </div>
    </div>
</template>

<script
    lang="ts"
    setup>
    import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';

    const {fill = false, src} = defineProps<{
        readonly src: string;
        /* The demo takes the whole stage instead of standing in its middle, for a layout that fills a frame. */
        readonly fill?: boolean;
    }>();

    const host = useTemplateRef<HTMLDivElement>('host');

    let unmount: (() => void) | null = null;
    let gone = false;

    onMounted(async () => {
        // Only in the browser: React and the demo load once the page is there, never during the static render.
        const {mountDemo} = await import('./mount.tsx');
        const element = host.value;

        if (gone || element === null) {
            return;
        }

        unmount = await mountDemo(src, element);

        if (gone) {
            unmount();
        }
    });

    onBeforeUnmount(() => {
        gone = true;
        unmount?.();
    });
</script>

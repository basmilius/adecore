/* A Web Worker the way Vite bundles one, as the demo of a diff pool imports it. */
declare module '*?worker' {
    const WorkerConstructor: new () => Worker;
    export default WorkerConstructor;
}

declare module '*.vue' {
    import type { DefineComponent } from 'vue';

    const component: DefineComponent;
    export default component;
}

<template>
    <div class="home-showcase demo-stage demo-stage-fill vp-raw">
        <div
            ref="host"
            class="demo-host"/>
    </div>
</template>

<script
    lang="ts"
    setup>
    import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';

    const host = useTemplateRef<HTMLDivElement>('host');

    let unmount: (() => void) | null = null;
    let gone = false;

    onMounted(async () => {
        // Only in the browser, like a demo: React and the packages load once the page is there.
        const {mountDemo} = await import('./mount.tsx');
        const element = host.value;

        if (gone || element === null) {
            return;
        }

        unmount = await mountDemo('home/showcase', element);

        if (gone) {
            unmount();
        }
    });

    onBeforeUnmount(() => {
        gone = true;
        unmount?.();
    });
</script>

<style scoped>
    .home-showcase {
        min-height: 560px;
        margin: 0 0 64px;
        background: transparent;
    }
</style>

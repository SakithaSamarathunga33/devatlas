import { motion } from "motion/react";

import { Graticule } from "./graticule";

export function WelcomeHero() {
  return (
    <section aria-labelledby="welcome-heading" className="relative isolate pt-8 pb-2">
      <Graticule className="pointer-events-none absolute -top-16 right-0 -z-10 size-80 [mask-image:radial-gradient(closest-side,black_45%,transparent)] text-primary/35 max-lg:opacity-50" />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-xl"
      >
        <h1
          id="welcome-heading"
          className="text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-balance"
        >
          Welcome to DevAtlas
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-pretty text-muted-foreground">
          A local-first workspace for the libraries, tools, components, and references you rely on.
          Capture them once, then find them again when a project needs them.
        </p>
      </motion.div>
    </section>
  );
}

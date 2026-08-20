import Image from "next/image";

export default function Page() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-6 pt-24">
        <h1 className="text-balance text-5xl font-semibold tracking-tight">
          Deploy a fix in four minutes, no YAML
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-lg">
          Who it is for, what it does, why now. No hype.
        </p>
        <a href="#start" className="mt-8 inline-flex min-h-11 rounded-card bg-brand-500 px-6">
          Start free
        </a>
        <Image
          src="/hero.avif"
          alt="A deploy finishing in the dashboard"
          width={1200}
          height={720}
          priority
        />
      </section>
    </main>
  );
}

import { NEXT_STEPS } from "@/lib/copy";

/** What to do with the result. Static; shown for every band. */
export function NextSteps() {
  return (
    <section className="section border-t border-line pt-5" aria-labelledby="next-title" data-testid="next-steps">
      <h2 id="next-title" className="text-2xl">
        {NEXT_STEPS.heading}
      </h2>
      <ul className="mt-3 space-y-3">
        {NEXT_STEPS.items.map((i) => (
          <li key={i.title}>
            <span className="font-medium">{i.title}</span> {i.text}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-base text-muted">{NEXT_STEPS.closing}</p>
    </section>
  );
}

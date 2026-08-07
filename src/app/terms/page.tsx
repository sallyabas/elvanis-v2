// Short ToS (spec §1.8, confirmed 2026-08-03) — required before any real
// evidence upload. Two specific disclaimers §1.8 calls out explicitly: the
// audit is advisory, not a guarantee, and (once that module exists for a
// given client) Tender Readiness output is not formal legal advice.
export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 text-sm leading-relaxed">
      <h1 className="mb-6 text-2xl font-semibold">Terms of Service</h1>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-medium">What Elvanis is</h2>
        <p>
          Elvanis is an AI-assisted execution audit — we analyze the evidence you submit and produce findings and
          recommendations, reviewed by a human before you see them. It&apos;s advisory, not a guarantee of outcomes. The
          quality of the analysis depends on the quality and completeness of the evidence you provide.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-medium">Not formal legal advice</h2>
        <p>
          Where Elvanis touches regulatory topics — such as Tender Readiness&apos;s AI Act/DIFC Regulation 10/SDAIA
          content, or Data Protection Compliance&apos;s GDPR/PDPL content — that output is informational, based on
          externally researched regulatory content, and is not formal legal advice. Consult a qualified professional
          for advice specific to your situation.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-medium">Your responsibilities</h2>
        <p>
          You&apos;re responsible for the accuracy of the evidence you submit, and for having the right to share it with
          us. Don&apos;t submit evidence you don&apos;t have the right to share.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-medium">Changes</h2>
        <p>We may update these terms as the product evolves. Continued use after a change means you accept it.</p>
      </section>
    </div>
  );
}

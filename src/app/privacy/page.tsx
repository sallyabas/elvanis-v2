// Full privacy policy page (spec §1.8, confirmed 2026-08-03) — required
// before any real evidence upload, per §1.8's own hard prerequisite.
// Content matches what §1.8 specifies: data collected, retention, named AI
// provider, storage, the human-review step, and a deletion request
// process. Adapted from the same structure the original Elvanis app used,
// per §5's task-breakdown note — this is new content for this platform,
// not a copy of anything from the old Elvanis codebase (which this project
// deliberately never touches).
export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 text-sm leading-relaxed">
      <h1 className="mb-6 text-2xl font-semibold">Privacy Policy</h1>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-medium">What we collect</h2>
        <p>
          When you use Elvanis, we collect the business information you provide directly (company name, goals, and
          the evidence you submit for each audit lens — financial, execution, product, commercial, and AI
          governance), plus basic account information (your email address, used for sign-in only — we never require
          a password).
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-medium">How your evidence is analyzed</h2>
        <p>
          The evidence you submit is sent to Groq, our AI provider, to generate draft findings for each lens. Groq
          processes this data to produce the analysis and does not use it to train its models. We do not share your
          evidence or findings with any other third party.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-medium">Human review, always</h2>
        <p>
          Every AI-drafted finding is reviewed by a human reviewer before you ever see it. A finding can be accepted,
          edited, or rejected by the reviewer — nothing reaches your report without passing through this step. This
          is enforced at the system level, not just a policy we follow.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-medium">Where your data is stored</h2>
        <p>
          Your evidence, findings, and reports are stored in Supabase, our database and file storage provider. Access
          to your data is restricted to your own account and to human reviewers who work on your audit.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-medium">How long we keep it</h2>
        <p>
          We retain your evidence and reports for as long as your account is active, so you can refer back to past
          audits and track progress over time. If you delete your account, we delete your data along with it, other
          than what we&apos;re required to keep for legal or accounting purposes.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-medium">Requesting deletion</h2>
        <p>
          You can request deletion of your account and all associated data at any time by contacting us. We&apos;ll
          confirm once the deletion is complete.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-medium">Questions</h2>
        <p>If you have questions about how your data is handled, contact us before submitting any evidence.</p>
      </section>
    </div>
  );
}

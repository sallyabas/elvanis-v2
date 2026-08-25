import { listIdeaBacklog, type IdeaSource, type IdeaStatus } from "@/lib/reviewer/idea-backlog";
import { createIdeaBacklogEntryAction, updateIdeaBacklogEntryAction, deleteIdeaBacklogEntryAction } from "./actions";
import { Card } from "@/app/_components/ui/Card";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { Button } from "@/app/_components/ui/Button";

/**
 * Internal idea/feedback backlog (confirmed 2026-08-25, direct founder
 * request) — its own distinct page, deliberately separate from the queue,
 * pricing panel, and company detail pages. Reviewer-only, same
 * (reviewer)/layout.tsx gate as everything else in this area. Built
 * entirely with plain forms + Server Actions (no client component) —
 * same convention already used throughout /queue, since nothing here
 * needs client-side interactivity beyond native <details> toggling and
 * form submission. AI-assisted expansion of a raw idea into a feature
 * brief is explicitly held for a future pass, not built here.
 */

const SOURCE_LABELS: Record<IdeaSource, string> = {
  own_idea: "My own idea",
  client_feedback: "Client feedback",
  third_party: "Third-party suggestion",
};

const STATUS_LABELS: Record<IdeaStatus, string> = {
  new: "New",
  considering: "Considering",
  in_progress: "In progress",
  done: "Done",
  declined: "Declined",
};

const STATUS_BADGE: Record<IdeaStatus, string> = {
  new: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  considering: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  declined: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default async function IdeaBacklogPage() {
  const ideas = await listIdeaBacklog();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Idea &amp; feedback backlog</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        Your own ideas, client feedback, and third-party suggestions in one structured list — separate from the
        reviewer queue.
      </p>

      <Card title="New entry" className="mb-8">
        <form action={createIdeaBacklogEntryAction} className="space-y-3">
          <Input label="Title" name="title" required />
          <Textarea label="Description" name="description" rows={3} />
          <Select label="Source" name="source" defaultValue="own_idea">
            {(Object.entries(SOURCE_LABELS) as [IdeaSource, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Button type="submit">Add entry</Button>
        </form>
      </Card>

      {ideas.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nothing in the backlog yet.</p>
      ) : (
        <ul className="space-y-4">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <Card>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-neutral-900 dark:text-neutral-50">{idea.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[idea.status]}`}>{STATUS_LABELS[idea.status]}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">· {SOURCE_LABELS[idea.source]}</span>
                </div>
                {idea.description && <p className="mb-3 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-400">{idea.description}</p>}

                <div className="flex flex-wrap items-center gap-2">
                  {/* Quick status change — the most frequently-updated field, its own small form. */}
                  <form action={updateIdeaBacklogEntryAction.bind(null, idea.id)} className="flex items-center gap-1.5">
                    <Select name="status" defaultValue={idea.status} className="py-1 text-xs">
                      {(Object.entries(STATUS_LABELS) as [IdeaStatus, string][]).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                      Update status
                    </Button>
                  </form>

                  <form action={deleteIdeaBacklogEntryAction.bind(null, idea.id)}>
                    <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                      Delete
                    </Button>
                  </form>
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-neutral-500 underline hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
                    Edit title / description / source
                  </summary>
                  <form action={updateIdeaBacklogEntryAction.bind(null, idea.id)} className="mt-3 space-y-3">
                    <Input label="Title" name="title" defaultValue={idea.title} />
                    <Textarea label="Description" name="description" rows={3} defaultValue={idea.description} />
                    <Select label="Source" name="source" defaultValue={idea.source}>
                      {(Object.entries(SOURCE_LABELS) as [IdeaSource, string][]).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                      Save changes
                    </Button>
                  </form>
                </details>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

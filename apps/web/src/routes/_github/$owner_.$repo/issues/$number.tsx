import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, ExternalLink, FileCode } from "lucide-react";
import { ContentCard } from "@/components/repo/content-card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_github/$owner_/$repo/issues/$number")({
  component: IssueDetailPage,
});

function IssueDetailPage() {
  const { owner, repo, number } = Route.useParams();
  const fullName = `${owner}/${repo}`;
  const issueNumber = Number.parseInt(number, 10);

  const repoData = useQuery(
    api.repos.getByFullName,
    fullName ? { fullName } : "skip",
  );

  const issue = repoData?.issues?.find((i) => i.number === issueNumber);
  const isNotIndexed = repoData === null;

  // Show "Repository Not Indexed" for unindexed repos
  if (isNotIndexed) {
    return (
      <ContentCard title="Repository Not Indexed">
        <p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
          This repository hasn't been analyzed yet. Please index the repository
          first to view issues.
        </p>
        <Link
          to="/$owner/$repo"
          params={{ owner, repo }}
          className="inline-block border border-primary bg-primary px-6 py-3 font-mono text-primary-foreground hover:bg-primary/90"
        >
          Go to Summary to Index
        </Link>
      </ContentCard>
    );
  }

  if (!repoData || !issue) {
    return (
      <ContentCard>
        <Link
          to="/$owner/$repo/issues"
          params={{ owner, repo }}
          className="mb-4 inline-flex items-center gap-2 font-mono text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Issues
        </Link>
        <h2 className="font-mono font-semibold text-2xl">
          {repoData === undefined ? "Loading..." : "Issue not found"}
        </h2>
      </ContentCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/$owner/$repo/issues"
        params={{ owner, repo }}
        className="inline-flex items-center gap-2 font-mono text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Issues
      </Link>

      {/* Issue header */}
      <div className="border border-primary/10 bg-card p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span className="font-mono text-muted-foreground">
                #{issue.number}
              </span>
              <DifficultyBadge difficulty={issue.difficulty || 3} />
            </div>
            <h1 className="wrap-break-word font-bold font-mono text-3xl">
              {issue.title}
            </h1>
          </div>
          <a
            href={issue.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 font-mono text-primary text-sm hover:underline"
          >
            View on GitHub
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>

      {/* AI Summary */}
      {issue.aiSummary && (
        <ContentCard title="Summary">
          <p className="font-serif text-lg leading-relaxed">
            {issue.aiSummary}
          </p>
        </ContentCard>
      )}

      {/* Skills Required */}
      {issue.skillsRequired && issue.skillsRequired.length > 0 && (
        <ContentCard title="Skills Required">
          <div className="flex flex-wrap gap-2">
            {issue.skillsRequired.map((skill) => (
              <Badge key={skill} variant="outline" className="font-mono">
                {skill}
              </Badge>
            ))}
          </div>
        </ContentCard>
      )}

      {/* Files Likely Touched - WITH CLICKABLE GITHUB LINKS */}
      {issue.filesLikelyTouched && issue.filesLikelyTouched.length > 0 && (
        <ContentCard title="Files Likely Touched">
          <ul className="space-y-2">
            {issue.filesLikelyTouched.map((file) => (
              <li key={file} className="flex items-center gap-2">
                <FileCode className="size-4 shrink-0 text-muted-foreground" />
                <a
                  href={`https://github.com/${fullName}/blob/${repoData?.defaultBranch || "main"}/${file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-primary text-sm hover:underline"
                >
                  {file}
                </a>
              </li>
            ))}
          </ul>
        </ContentCard>
      )}

      {/* Labels */}
      {issue.labels && issue.labels.length > 0 && (
        <ContentCard title="Labels">
          <div className="flex flex-wrap gap-2">
            {issue.labels.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        </ContentCard>
      )}
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: number }) {
  const config = getDifficultyConfig(difficulty);
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 ${config.bgClass} ${config.borderClass}`}
    >
      <div className={`size-2 rounded-full ${config.dotClass}`} />
      <span className={`font-mono text-xs ${config.textClass}`}>
        {config.label}
      </span>
    </div>
  );
}

function getDifficultyConfig(difficulty: number) {
  const configs: Record<
    number,
    {
      label: string;
      bgClass: string;
      borderClass: string;
      dotClass: string;
      textClass: string;
    }
  > = {
    1: {
      label: "Good First Issue",
      bgClass: "bg-green-500/10",
      borderClass: "border-green-500/20",
      dotClass: "bg-green-500",
      textClass: "text-green-600 dark:text-green-400",
    },
    2: {
      label: "Easy",
      bgClass: "bg-blue-500/10",
      borderClass: "border-blue-500/20",
      dotClass: "bg-blue-500",
      textClass: "text-blue-600 dark:text-blue-400",
    },
    3: {
      label: "Moderate",
      bgClass: "bg-yellow-500/10",
      borderClass: "border-yellow-500/20",
      dotClass: "bg-yellow-500",
      textClass: "text-yellow-600 dark:text-yellow-400",
    },
    4: {
      label: "Challenging",
      bgClass: "bg-orange-500/10",
      borderClass: "border-orange-500/20",
      dotClass: "bg-orange-500",
      textClass: "text-orange-600 dark:text-orange-400",
    },
    5: {
      label: "Advanced",
      bgClass: "bg-red-500/10",
      borderClass: "border-red-500/20",
      dotClass: "bg-red-500",
      textClass: "text-red-600 dark:text-red-400",
    },
  };
  return configs[difficulty] || configs[3];
}

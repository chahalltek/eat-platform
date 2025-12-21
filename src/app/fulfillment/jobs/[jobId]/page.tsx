import { JobDetailCockpit, type JobSummary } from "./JobDetailCockpit";

type PageParams = {
  params: { jobId: string };
  searchParams: Record<string, string | string[] | undefined>;
};

export default function FulfillmentJobPage({ params, searchParams }: PageParams) {
  const jobId = params.jobId;
  const from = typeof searchParams.from === "string" ? searchParams.from : undefined;
  const returnUrl = typeof searchParams.returnUrl === "string" ? searchParams.returnUrl : undefined;

  const jobSummary: JobSummary = {
    id: jobId,
    title: "Job detail cockpit",
    client: "Client to be assigned",
    priority: "Prioritization pending",
    owner: "Owner to be assigned",
  };

  return (
    <JobDetailCockpit
      job={jobSummary}
      returnUrl={returnUrl}
      showDeepLinkBanner={Boolean(from || returnUrl)}
      sourceSystem={from}
    />
  );
}

import BreakApprovalsClient from "./BreakApprovalsClient";

export const dynamic = "force-dynamic";

export default function BreakApprovalsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <BreakApprovalsClient />
    </div>
  );
}

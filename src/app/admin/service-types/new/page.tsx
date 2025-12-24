import { redirect } from "next/navigation";
import ServiceTypeForm from "../ServiceTypeForm";
import { createServiceType } from "../actions";

export default function NewServiceTypePage() {
  async function handleCreate(formData: FormData) {
    "use server";
    await createServiceType(formData);
    redirect("/admin/service-types");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">New Service Type</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Create a new service category
        </p>
      </div>

      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <ServiceTypeForm
          action={handleCreate}
          submitLabel="Create Service Type"
          cancelHref="/admin/service-types"
        />
      </div>
    </div>
  );
}

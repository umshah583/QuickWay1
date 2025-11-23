import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const DOCUMENT_FIELDS = {
  "labour-card": {
    bytes: "labourCardFileBytes" as const,
    name: "labourCardFileName" as const,
    type: "labourCardFileType" as const,
  },
  "emirates-id-front": {
    bytes: "emiratesIdFrontBytes" as const,
    name: "emiratesIdFrontName" as const,
    type: "emiratesIdFrontType" as const,
  },
  "emirates-id-back": {
    bytes: "emiratesIdBackBytes" as const,
    name: "emiratesIdBackName" as const,
    type: "emiratesIdBackType" as const,
  },
} satisfies Record<string, { bytes: BytesField; name: NameField; type: TypeField }>;

type BytesField =
  | "labourCardFileBytes"
  | "emiratesIdFrontBytes"
  | "emiratesIdBackBytes";

type NameField =
  | "labourCardFileName"
  | "emiratesIdFrontName"
  | "emiratesIdBackName";

type TypeField =
  | "labourCardFileType"
  | "emiratesIdFrontType"
  | "emiratesIdBackType";

type DocumentKey = keyof typeof DOCUMENT_FIELDS;

export async function GET(request: Request, { params }: { params: Promise<{ id: string; doc: string }> }) {
  const resolvedParams = await params;
  await requireAdminSession();

  const documentKey = resolvedParams.doc as DocumentKey;
  const mapping = DOCUMENT_FIELDS[documentKey];

  if (!mapping) {
    return NextResponse.json({ error: "Unknown document type" }, { status: 404 });
  }

  const driverRequest = await prisma.partnerDriverRequest.findUnique({
    where: { id: resolvedParams.id },
    select: {
      labourCardFileBytes: true,
      labourCardFileName: true,
      labourCardFileType: true,
      emiratesIdFrontBytes: true,
      emiratesIdFrontName: true,
      emiratesIdFrontType: true,
      emiratesIdBackBytes: true,
      emiratesIdBackName: true,
      emiratesIdBackType: true,
    },
  });

  if (!driverRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const bytes = driverRequest[mapping.bytes];
  const name = driverRequest[mapping.name];
  const type = driverRequest[mapping.type];

  if (!bytes || !name) {
    return NextResponse.json({ error: "Document not available" }, { status: 404 });
  }

  const url = new URL(request.url);
  const forceDownload = url.searchParams.get("download") === "1";

  const byteArray = bytes instanceof Buffer
    ? Uint8Array.from(bytes)
    : Uint8Array.from(bytes);
  const arrayBuffer = byteArray.buffer.slice(byteArray.byteOffset, byteArray.byteOffset + byteArray.byteLength);

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": type ?? "application/octet-stream",
      "Content-Disposition": `${forceDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

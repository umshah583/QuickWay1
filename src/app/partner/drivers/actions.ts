"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePartnerSession } from "@/lib/partner-auth";
import { prisma } from "@/lib/prisma";

type UploadBytes = Uint8Array<ArrayBuffer>;
const toBuffer = (bytes: UploadBytes | null | undefined) => (bytes ? Buffer.from(bytes) : null);

const driverSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  mobileNumber: z
    .string()
    .trim()
    .min(5, 'Mobile number is required')
    .max(20, 'Mobile number is too long'),
  visaIssueDate: z.string().min(1, 'Visa issue date is required'),
  visaExpiryDate: z.string().min(1, 'Visa expiry date is required'),
  documentType: z.enum(['LABOUR_CARD', 'EMIRATES_ID']),
  requestId: z.string().trim().optional(),
});

export type CreatePartnerDriverState = {
  error?: string;
};

export async function createPartnerDriver(
  prevState: CreatePartnerDriverState,
  formData: FormData,
): Promise<CreatePartnerDriverState> {
  const session = await requirePartnerSession();
  const partnerUserId = session.user?.id;

  if (!partnerUserId) {
    return { error: 'Unable to verify partner session.' };
  }

  const partner = await prisma.partner.findUnique({ where: { userId: partnerUserId }, select: { id: true, name: true } });

  if (!partner) {
    return { error: 'Partner profile not found for this account.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = driverSchema.safeParse(raw);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input';
    return { error: firstError };
  }

  const { name, email, password, mobileNumber, visaIssueDate, visaExpiryDate, documentType, requestId } = parsed.data;

  const issueDate = new Date(visaIssueDate);
  const expiryDate = new Date(visaExpiryDate);

  if (Number.isNaN(issueDate.getTime())) {
    return { error: 'Visa issue date is invalid.' };
  }

  if (Number.isNaN(expiryDate.getTime())) {
    return { error: 'Visa expiry date is invalid.' };
  }

  if (expiryDate <= issueDate) {
    return { error: 'Visa expiry date must be after the issue date.' };
  }

  const labourCardFile = formData.get('labourCard');
  const emiratesIdFrontFile = formData.get('emiratesIdFront');
  const emiratesIdBackFile = formData.get('emiratesIdBack');

  type UploadFile = { bytes: UploadBytes; name: string; type: string };
  let labourCardUpload: UploadFile | null = null;
  let emiratesFrontUpload: UploadFile | null = null;
  let emiratesBackUpload: UploadFile | null = null;

  async function toUpload(file: unknown, label: string) {
    if (!(file instanceof File) || file.size === 0) {
      throw new Error(`${label} file is required.`);
    }
    const arrayBuffer = (await file.arrayBuffer()) as ArrayBuffer;
    const bytes = new Uint8Array(arrayBuffer) as UploadBytes;
    return {
      bytes,
      name: file.name,
      type: file.type || 'application/octet-stream',
    };
  }

  try {
    if (documentType === 'LABOUR_CARD') {
      labourCardUpload = await toUpload(labourCardFile, 'Labour card');
    } else {
      emiratesFrontUpload = await toUpload(emiratesIdFrontFile, 'Emirates ID (front)');
      emiratesBackUpload = await toUpload(emiratesIdBackFile, 'Emirates ID (back)');
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: 'Unable to process uploaded documents.' };
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  if (requestId) {
    const existingRequest = await prisma.partnerDriverRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        partnerId: true,
        status: true,
        email: true,
        rejectionCount: true,
      },
    });

    if (!existingRequest || existingRequest.partnerId !== partner.id) {
      return { error: 'Request not found.' };
    }

    if (existingRequest.rejectionCount >= 3) {
      return { error: 'This request has reached the maximum number of resubmission attempts.' };
    }

    if (existingRequest.status !== 'REJECTED') {
      return { error: 'Only rejected requests can be resubmitted.' };
    }

    await prisma.partnerDriverRequest.update({
      where: { id: requestId },
      data: {
        name,
        email,
        passwordHash,
        mobileNumber,
        visaIssueDate: issueDate,
        visaExpiryDate: expiryDate,
        documentType,
        labourCardFileBytes: toBuffer(labourCardUpload?.bytes),
        labourCardFileName: labourCardUpload?.name ?? null,
        labourCardFileType: labourCardUpload?.type ?? null,
        emiratesIdFrontBytes: toBuffer(emiratesFrontUpload?.bytes),
        emiratesIdFrontName: emiratesFrontUpload?.name ?? null,
        emiratesIdFrontType: emiratesFrontUpload?.type ?? null,
        emiratesIdBackBytes: toBuffer(emiratesBackUpload?.bytes),
        emiratesIdBackName: emiratesBackUpload?.name ?? null,
        emiratesIdBackType: emiratesBackUpload?.type ?? null,
        status: 'PENDING',
        rejectionReason: null,
        processedAt: null,
        processedById: null,
      },
    });
  } else {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return { error: 'A user with this email already exists.' };
    }

    const pendingRequest = await prisma.partnerDriverRequest.findFirst({
      where: {
        partnerId: partner.id,
        email,
        status: 'PENDING',
      },
      select: { id: true },
    });

    if (pendingRequest) {
      return { error: 'A pending approval for this driver already exists.' };
    }

    await prisma.partnerDriverRequest.create({
      data: {
        partnerId: partner.id,
        name,
        email,
        passwordHash,
        mobileNumber,
        visaIssueDate: issueDate,
        visaExpiryDate: expiryDate,
        documentType,
        labourCardFileBytes: toBuffer(labourCardUpload?.bytes),
        labourCardFileName: labourCardUpload?.name ?? null,
        labourCardFileType: labourCardUpload?.type ?? null,
        emiratesIdFrontBytes: toBuffer(emiratesFrontUpload?.bytes),
        emiratesIdFrontName: emiratesFrontUpload?.name ?? null,
        emiratesIdFrontType: emiratesFrontUpload?.type ?? null,
        emiratesIdBackBytes: toBuffer(emiratesBackUpload?.bytes),
        emiratesIdBackName: emiratesBackUpload?.name ?? null,
        emiratesIdBackType: emiratesBackUpload?.type ?? null,
        status: 'PENDING',
      },
    });
  }

  revalidatePath('/partner');
  revalidatePath('/partner/drivers');
  revalidatePath('/admin/partners/driver-requests');
  redirect('/partner/drivers?driverRequest=1');
}

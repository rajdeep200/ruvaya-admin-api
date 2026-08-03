import "server-only";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/http/api";

type AddressInput = {
  label?: string | null;
  fullName: string;
  phone: string;
  email?: string | null;
  addressLine: string;
  locality?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
};

export async function listAddresses(accountId: string) {
  return prisma.accountAddress.findMany({
    where: { accountId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function createAddress(accountId: string, input: AddressInput) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.accountAddress.updateMany({ where: { accountId }, data: { isDefault: false } });
    return tx.accountAddress.create({ data: { ...input, accountId } });
  });
}

export async function updateAddress(accountId: string, id: string, input: Partial<AddressInput>) {
  const existing = await prisma.accountAddress.findFirst({ where: { id, accountId } });
  if (!existing) throw new ApiError("NOT_FOUND", "Address not found", 404);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.accountAddress.updateMany({ where: { accountId }, data: { isDefault: false } });
    return tx.accountAddress.update({ where: { id }, data: input });
  });
}

export async function deleteAddress(accountId: string, id: string) {
  const existing = await prisma.accountAddress.findFirst({ where: { id, accountId } });
  if (!existing) throw new ApiError("NOT_FOUND", "Address not found", 404);
  await prisma.accountAddress.delete({ where: { id } });
}

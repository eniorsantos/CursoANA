import { prisma } from "./prisma.js";

// Fonte única de verdade para checagem de acesso (compra avulsa OU assinatura).
export async function hasAccessToCourse(userId: string, courseId: string): Promise<boolean> {
  const directEnrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (directEnrollment?.status === "ACTIVE") return true;

  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      currentPeriodEnd: { gt: new Date() },
      plan: {
        OR: [{ isAllCourses: true }, { courses: { some: { courseId } } }],
      },
    },
  });
  return !!activeSubscription;
}

import ReturnClient from "./ReturnClient";

export const dynamic = "force-dynamic";

export default function PaymentReturnPage({
  searchParams,
}: {
  searchParams: { orderReference?: string };
}) {
  const orderReference = searchParams?.orderReference || "";
  return <ReturnClient orderReference={orderReference} />;
}

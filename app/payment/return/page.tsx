import Link from "next/link"

export default function PaymentReturnPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const orderReference = Array.isArray(searchParams.orderReference)
    ? searchParams.orderReference[0]
    : searchParams.orderReference

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-semibold">Payment processing</h1>

      <p className="mt-4 text-gray-700">
        {orderReference
          ? <>Order reference: <span className="font-mono">{orderReference}</span></>
          : <>Order reference not provided</>
        }
      </p>

      <div className="mt-6 space-y-3 text-gray-700">
        <p>
          If payment was successful, access will be activated automatically.
        </p>
        <p>
          Usually it takes 5–30 seconds. If you do not see access, refresh the page or open Profile.
        </p>
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/profile"
          className="px-4 py-2 rounded-md bg-black text-white"
        >
          Go to Profile
        </Link>

        <Link
          href="/pricing"
          className="px-4 py-2 rounded-md border border-gray-300"
        >
          Back to Pricing
        </Link>
      </div>
    </main>
  )
}

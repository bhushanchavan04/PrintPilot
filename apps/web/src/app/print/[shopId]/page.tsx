import { CustomerPrintPage } from '@/components/customer/CustomerPrintPage'

interface PrintPageProps {
  params: { shopId: string }
}

export default function PrintPage({ params }: PrintPageProps) {
  return <CustomerPrintPage shopSlug={params.shopId} />
}

export async function generateMetadata({ params }: PrintPageProps) {
  return {
    title: `Print Documents`,
    description: 'Upload and print documents at your local print shop',
  }
}


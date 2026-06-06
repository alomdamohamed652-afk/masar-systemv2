'use client'
import ProductForm from '@/components/products/ProductForm'
import { PageHeader } from '@/components/shared'
export default function NewProductPage() {
  return (
    <>
      <PageHeader title="منتج جديد" subtitle="إضافة منتج جديد إلى الكتالوج" />
      <div className="page-body"><ProductForm /></div>
    </>
  )
}

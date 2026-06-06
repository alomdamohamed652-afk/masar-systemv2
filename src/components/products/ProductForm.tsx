'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FormGrid, SectionTitle, Modal } from '@/components/shared'
import type { Product, Category, ProductVariant } from '@/types'

interface VariantRow { color: string; size: string; sku_variant: string }

interface Props {
  product?: Product
  onSaved?: () => void
}

export default function ProductForm({ product, onSaved }: Props) {
  const router = useRouter()
  const isEdit = !!product

  const [saving, setSaving]       = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [showCatModal, setShowCatModal] = useState(false)

  // Fields
  const [name, setName]           = useState(product?.name ?? '')
  const [sku, setSku]             = useState(product?.sku ?? '')
  const [barcode, setBarcode]     = useState(product?.barcode ?? '')
  const [internalCode, setInternalCode] = useState(product?.internal_code ?? '')
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '')
  const [supplier, setSupplier]   = useState(product?.supplier ?? '')
  const [brand, setBrand]         = useState(product?.brand ?? '')
  const [description, setDesc]    = useState(product?.description ?? '')
  const [costPrice, setCostPrice] = useState(String(product?.cost_price ?? ''))
  const [sellPrice, setSellPrice] = useState(String(product?.sell_price ?? ''))

  // Variants
  const [variants, setVariants]   = useState<VariantRow[]>(
    product?.variants?.map(v => ({
      color: v.color ?? '', size: v.size ?? '', sku_variant: v.sku_variant ?? ''
    })) ?? []
  )

  // Images (URLs after upload)
  const [images, setImages]       = useState<{ image_url: string; is_primary: boolean; sort_order: number }[]>(
    product?.images?.map(i => ({
      image_url: i.image_url, is_primary: i.is_primary, sort_order: i.sort_order
    })) ?? []
  )
  const [uploadingImg, setUploadingImg] = useState(false)

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(j => setCategories(j.data ?? []))
  }, [])

  // ── Variants ──────────────────────────────────────────────
  const addVariant = () => setVariants(v => [...v, { color: '', size: '', sku_variant: '' }])
  const removeVariant = (i: number) => setVariants(v => v.filter((_, j) => j !== i))
  const updateVariant = (i: number, field: keyof VariantRow, val: string) =>
    setVariants(v => v.map((row, j) => j === i ? { ...row, [field]: val } : row))

  // ── Image upload ─────────────────────────────────────────
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImg(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', 'product-images')
      const res  = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setImages(imgs => [
        ...imgs,
        { image_url: json.data.url, is_primary: imgs.length === 0, sort_order: imgs.length },
      ])
      toast.success('تم رفع الصورة')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'خطأ في رفع الصورة')
    } finally {
      setUploadingImg(false)
      e.target.value = ''
    }
  }

  const setPrimary = (idx: number) =>
    setImages(imgs => imgs.map((img, i) => ({ ...img, is_primary: i === idx })))
  const removeImage = (idx: number) => setImages(imgs => imgs.filter((_, i) => i !== idx))

  // ── Add category ─────────────────────────────────────────
  async function handleAddCategory() {
    if (!newCategory.trim()) return
    try {
      const res  = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory.trim() }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCategories(c => [...c, json.data])
      setCategoryId(json.data.id)
      setNewCategory('')
      setShowCatModal(false)
      toast.success('تم إضافة الفئة')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'خطأ في إضافة الفئة')
    }
  }

  // ── Save ─────────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) { toast.error('اسم المنتج مطلوب'); return }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(), sku: sku || null, barcode: barcode || null,
        internal_code: internalCode || null, category_id: categoryId || null,
        supplier: supplier || null, brand: brand || null,
        description: description || null,
        cost_price: Number(costPrice) || 0,
        sell_price: Number(sellPrice) || 0,
        variants: variants.filter(v => v.color || v.size),
        images,
      }

      const url    = isEdit ? `/api/products/${product!.id}` : '/api/products'
      const method = isEdit ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      toast.success(isEdit ? 'تم تحديث المنتج' : 'تم إنشاء المنتج')
      if (onSaved) onSaved()
      else router.push(`/products/${json.data.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'خطأ في حفظ المنتج')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Basic info */}
      <div className="card card-pad">
        <SectionTitle>المعلومات الأساسية</SectionTitle>
        <FormGrid cols={2}>
          <div className="form-group">
            <label className="form-label">اسم المنتج <span className="required">*</span></label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="مثال: قميص كلاسيك" />
          </div>
          <div className="form-group">
            <label className="form-label">
              الفئة
              <button type="button" onClick={() => setShowCatModal(true)}
                style={{ marginRight: 8, fontSize: '.72rem', color: 'var(--color-green)', background: 'none', border: 'none', cursor: 'pointer' }}>
                + إضافة فئة
              </button>
            </label>
            <select className="form-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">بدون فئة</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">SKU</label>
            <input className="form-input" value={sku} onChange={e => setSku(e.target.value)} placeholder="MSR-001" dir="ltr" />
          </div>
          <div className="form-group">
            <label className="form-label">باركود</label>
            <input className="form-input" value={barcode} onChange={e => setBarcode(e.target.value)} dir="ltr" />
          </div>
          <div className="form-group">
            <label className="form-label">الكود الداخلي</label>
            <input className="form-input" value={internalCode} onChange={e => setInternalCode(e.target.value)} dir="ltr" />
          </div>
          <div className="form-group">
            <label className="form-label">المورّد</label>
            <input className="form-input" value={supplier} onChange={e => setSupplier(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">العلامة التجارية</label>
            <input className="form-input" value={brand} onChange={e => setBrand(e.target.value)} />
          </div>
        </FormGrid>
        <div className="form-group" style={{ marginTop: 14 }}>
          <label className="form-label">الوصف</label>
          <textarea className="form-textarea" value={description} onChange={e => setDesc(e.target.value)} rows={3} />
        </div>
      </div>

      {/* Pricing */}
      <div className="card card-pad">
        <SectionTitle>التسعير</SectionTitle>
        <FormGrid cols={2}>
          <div className="form-group">
            <label className="form-label">سعر التكلفة</label>
            <input className="form-input" type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} dir="ltr" />
          </div>
          <div className="form-group">
            <label className="form-label">سعر البيع <span className="required">*</span></label>
            <input className="form-input" type="number" min="0" step="0.01" value={sellPrice} onChange={e => setSellPrice(e.target.value)} dir="ltr" />
          </div>
        </FormGrid>
        {costPrice && sellPrice && Number(sellPrice) > 0 && (
          <div style={{ marginTop: 10, fontSize: '.85rem', color: 'var(--color-text-muted)' }}>
            هامش الربح:{' '}
            <strong style={{ color: 'var(--color-green)' }}>
              {(((Number(sellPrice) - Number(costPrice)) / Number(sellPrice)) * 100).toFixed(1)}%
            </strong>
          </div>
        )}
      </div>

      {/* Variants */}
      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionTitle>المتغيرات (الألوان والمقاسات)</SectionTitle>
          <button type="button" className="btn btn-outline btn-sm" onClick={addVariant}>+ إضافة متغير</button>
        </div>
        {variants.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '.85rem' }}>لا توجد متغيرات — المنتج بحجم ولون واحد</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {variants.map((v, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                <input className="form-input" placeholder="اللون" value={v.color}
                  onChange={e => updateVariant(i, 'color', e.target.value)} />
                <input className="form-input" placeholder="المقاس (S, M, L...)" value={v.size}
                  onChange={e => updateVariant(i, 'size', e.target.value)} />
                <input className="form-input" placeholder="SKU المتغير" value={v.sku_variant}
                  onChange={e => updateVariant(i, 'sku_variant', e.target.value)} dir="ltr" />
                <button type="button" className="btn btn-danger btn-icon" onClick={() => removeVariant(i)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Images */}
      <div className="card card-pad">
        <SectionTitle>صور المنتج</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {images.map((img, i) => (
            <div key={i} style={{
              position: 'relative', width: 100, height: 100,
              borderRadius: 'var(--radius-md)', overflow: 'hidden',
              border: img.is_primary ? '2.5px solid var(--color-green)' : '1.5px solid var(--color-border)',
            }}>
              <img src={img.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(0,0,0,.55)',
                display: 'flex', justifyContent: 'space-between',
                padding: '3px 5px',
              }}>
                <button type="button" onClick={() => setPrimary(i)}
                  style={{ background: 'none', border: 'none', color: img.is_primary ? '#FFD700' : '#fff', fontSize: '.7rem', cursor: 'pointer' }}>
                  ★
                </button>
                <button type="button" onClick={() => removeImage(i)}
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: '.7rem', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            </div>
          ))}

          {/* Upload button */}
          <label style={{
            width: 100, height: 100,
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            cursor: uploadingImg ? 'wait' : 'pointer',
            color: 'var(--color-text-muted)',
            fontSize: '.75rem', gap: 4,
          }}>
            {uploadingImg ? <span className="spinner" /> : <>📷<span>رفع صورة</span></>}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploadingImg} />
          </label>
        </div>
        <p style={{ fontSize: '.75rem', color: 'var(--color-text-muted)' }}>انقر على ★ لتعيين الصورة الرئيسية</p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-outline" onClick={() => router.back()}>إلغاء</button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> جارٍ الحفظ...</> : (isEdit ? 'حفظ التعديلات' : 'إنشاء المنتج')}
        </button>
      </div>

      {/* Category modal */}
      <Modal open={showCatModal} onClose={() => setShowCatModal(false)} title="إضافة فئة جديدة" size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowCatModal(false)}>إلغاء</button>
            <button className="btn btn-primary" onClick={handleAddCategory}>إضافة</button>
          </>
        }>
        <div className="form-group">
          <label className="form-label">اسم الفئة</label>
          <input className="form-input" value={newCategory} onChange={e => setNewCategory(e.target.value)}
            placeholder="مثال: قمصان، بناطيل..." onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
        </div>
      </Modal>
    </div>
  )
}

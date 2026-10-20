import { describe, expect, it, beforeEach } from "vitest";
import type { Repositories } from "@/repositories/types";
import type {
  AuditEvent,
  BusinessProfile,
  GstSupplyType,
  Product,
  ProductBatch,
  PurchaseInvoice,
  PurchaseOrder,
  SalesInvoice,
  Supplier,
} from "@/types/domain";
import { allocateReceivedQuantities, receivingStatusForItems } from "@/lib/purchase-receiving";
import { DOCUMENT_CONTROL_KEY, todayIsoDate } from "@/lib/document-control";
import { AuditService } from "./audit.service";
import { NotificationService } from "./notification.service";
import { TransactionService } from "./transaction.service";
import { AppError } from "@/lib/errors";

function shiftIsoDate(days: number, from = todayIsoDate()): string {
  const date = new Date(`${from}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function memoryRepositories() {
  const products: Product[] = [];
  const salesInvoices: SalesInvoice[] = [];
  const purchaseInvoices: PurchaseInvoice[] = [];
  const payments: Array<{
    id: string;
    businessId?: string;
    documentNo?: string | null;
    direction: string;
    partyType?: string;
    partyId?: string | null;
    salesInvoiceId: string | null;
    purchaseInvoiceId: string | null;
    amount: number;
    mode: string;
    reference?: string | null;
    paymentDate?: string;
    notes?: string | null;
    status?: string;
    cancelledAt?: string | null;
    cancelledBy?: string | null;
    allocations?: Array<{ id: string; businessId: string; paymentId: string; salesInvoiceId: string | null; purchaseInvoiceId: string | null; amount: number; createdAt: string }>;
    createdAt?: string;
  }> = [];
  const ledger: Array<{
    id: string;
    businessId: string;
    productId: string;
    change: number;
    movementType: string;
    batchId: string | null;
    warehouseId: string | null;
    variantId: string | null;
    locationId: string | null;
    toWarehouseId: string | null;
    toLocationId: string | null;
    reason: string;
    referenceType: string | null;
    referenceId: string | null;
    notes: string | null;
    createdAt: string;
  }> = [];
  const sequences = new Map<string, number>();
  const memberPermissions: string[] = ["*"];
  const batches: ProductBatch[] = [];
  const auditLogs: AuditEvent[] = [];
  const receipts: unknown[] = [];
  const purchaseOrders: PurchaseOrder[] = [];
  const purchaseReturns: unknown[] = [];
  const salesReturns: unknown[] = [];
  const settings = new Map<string, unknown>();
  const suppliers: Supplier[] = [];
  const paymentModes: Array<{ id: string; businessId: string; code: string; name: string; isActive: boolean; sortOrder: number; createdAt: string; updatedAt: string }> = [
    { id: "m-cash", businessId: "b-1", code: "cash", name: "Cash", isActive: true, sortOrder: 10, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "m-upi", businessId: "b-1", code: "upi", name: "UPI", isActive: true, sortOrder: 20, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];

  const repos: Repositories = {
    products: {
      async listCategories() { return []; },
      async updateCategory() { throw new Error("not used"); },
      async deleteCategory() {},
      async createCategory() { throw new Error("not used"); },
      async listProducts() { return products; },
      async getProduct(_b, id) { return products.find((p) => p.id === id) ?? null; },
      async createProduct(businessId, _u, input) {
        const product: Product = {
          id: `p-${products.length + 1}`,
          businessId,
          name: input.name,
          description: input.description ?? null,
          sku: input.sku ?? null,
          barcode: input.barcode ?? null,
          categoryId: input.categoryId ?? null,
          brandId: input.brandId ?? null,
          unitId: input.unitId ?? null,
          unit: input.unit ?? "pcs",
          packUnit: input.packUnit ?? null,
          packUnitId: input.packUnitId ?? null,
          unitsPerPack: input.unitsPerPack ?? 1,
          minSaleQty: input.minSaleQty ?? 1,
          maxSaleQty: input.maxSaleQty ?? null,
          allowBaseSale: input.allowBaseSale ?? true,
          allowPackSale: input.allowPackSale ?? false,
          allowPackPurchase: input.allowPackPurchase ?? true,
          fixedPacking: input.fixedPacking ?? true,
          attributes: input.attributes ?? {},
          gstRate: input.gstRate ?? 0,
          hsn: input.hsn ?? null,
          purchasePrice: input.purchasePrice ?? 0,
          salePrice: input.salePrice ?? 0,
          mrp: input.mrp ?? null,
          lowStockThreshold: input.lowStockThreshold ?? 0,
          minStock: input.minStock ?? 0,
          maxStock: input.maxStock ?? null,
          reorderLevel: input.reorderLevel ?? 0,
          trackInventory: input.trackInventory ?? true,
          taxable: input.taxable ?? true,
          gstSupplyType: input.gstSupplyType ?? "taxable",
          reverseCharge: input.reverseCharge ?? false,
          productStatus: input.productStatus ?? "active",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        products.push(product);
        return product;
      },
      async updateProduct() { throw new Error("not used"); },
      async deleteProduct() {},
      async listBatches(_b, productId) {
        return batches.filter((batch) => !productId || batch.productId === productId);
      },
      async createBatch(businessId, input) {
        const now = new Date().toISOString();
        const batch: ProductBatch = {
          id: `batch-${batches.length + 1}`,
          businessId,
          productId: input.productId,
          batchNo: input.batchNo,
          expiryDate: input.expiryDate ?? null,
          mrp: input.mrp ?? null,
          purchasePrice: input.purchasePrice ?? null,
          createdAt: now,
          updatedAt: now,
        };
        batches.push(batch);
        return batch;
      },
      async updateBatch(_b, batchId, input) {
        const index = batches.findIndex((batch) => batch.id === batchId);
        if (index === -1) throw new Error("Batch not found.");
        batches[index] = {
          ...batches[index],
          expiryDate: input.expiryDate === undefined ? batches[index].expiryDate : input.expiryDate,
          mrp: input.mrp === undefined ? batches[index].mrp : input.mrp,
          purchasePrice: input.purchasePrice === undefined ? batches[index].purchasePrice : input.purchasePrice,
          updatedAt: new Date().toISOString(),
        };
        return batches[index];
      },
      async listStock() {
        const byProduct = new Map<string, number>();
        for (const entry of ledger) {
          byProduct.set(entry.productId, (byProduct.get(entry.productId) ?? 0) + entry.change);
        }
        return Array.from(byProduct.entries()).map(([productId, quantity]) => ({ productId, quantity, lastMovementAt: null }));
      },
      async listBalances() {
        const map = new Map<string, { productId: string; batchId: string | null; warehouseId: string | null; quantity: number }>();
        for (const entry of ledger) {
          const key = `${entry.productId}|${entry.batchId ?? ""}|${entry.warehouseId ?? ""}`;
          const current = map.get(key) ?? {
            productId: entry.productId,
            batchId: entry.batchId,
            warehouseId: entry.warehouseId,
            quantity: 0,
          };
          current.quantity += entry.change;
          map.set(key, current);
        }
        return Array.from(map.values()).map((row) => ({
          productId: row.productId,
          variantId: null,
          batchId: row.batchId,
          warehouseId: row.warehouseId,
          locationId: null,
          quantity: row.quantity,
          lastMovementAt: null,
        }));
      },
      async listMovements() { return ledger as never[]; },
      async listMovementsByReference(_b, referenceId) {
        return ledger
          .filter((entry) => entry.referenceId === referenceId)
          .map((entry) => ({
            id: entry.id,
            businessId: entry.businessId,
            productId: entry.productId,
            variantId: entry.variantId,
            batchId: entry.batchId,
            warehouseId: entry.warehouseId,
            locationId: entry.locationId,
            toWarehouseId: entry.toWarehouseId,
            toLocationId: entry.toLocationId,
            change: entry.change,
            movementType: entry.movementType as never,
            reason: entry.reason,
            referenceType: entry.referenceType,
            referenceId: entry.referenceId,
            notes: entry.notes,
            createdAt: entry.createdAt,
          }));
      },
      async addStockMovement(input) {
        ledger.push({
          id: `mv-${ledger.length + 1}`,
          businessId: input.businessId,
          productId: input.productId,
          change: input.change,
          movementType: input.movementType,
          batchId: input.batchId ?? null,
          warehouseId: input.warehouseId ?? null,
          variantId: input.variantId ?? null,
          locationId: input.locationId ?? null,
          toWarehouseId: input.toWarehouseId ?? null,
          toLocationId: input.toLocationId ?? null,
          reason: input.reason ?? input.movementType.toLowerCase(),
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          notes: input.notes ?? null,
          createdAt: new Date().toISOString(),
        });
      },
      async listVariants() { return []; },
      async createVariant() { throw new Error("not used"); },
      async updateVariant() { throw new Error("not used"); },
      async deleteVariant() {},
      async listImages() { return []; },
      async addImage() { throw new Error("not used"); },
      async removeImage() {},
      async listProductsForSearch() { return []; },
      async listStockForSearch() { return []; },
    },
    inventory: {
      async listUnits() { return []; },
      async createUnit() { throw new Error("not used"); },
      async updateUnit() { throw new Error("not used"); },
      async deleteUnit() {},
      async listBrands() { return []; },
      async createBrand() { throw new Error("not used"); },
      async updateBrand() { throw new Error("not used"); },
      async deleteBrand() {},
      async listWarehouses() { return []; },
      async createWarehouse() { throw new Error("not used"); },
      async updateWarehouse() { throw new Error("not used"); },
      async deleteWarehouse() {},
      async listLocations() { return []; },
      async createLocation() { throw new Error("not used"); },
      async updateLocation() { throw new Error("not used"); },
      async deleteLocation() {},
    },
    parties: {
      async listCustomers() { return []; },
      async getCustomer() { return null; },
      async createCustomer() { throw new Error("not used"); },
      async updateCustomer() { throw new Error("not used"); },
      async deleteCustomer() {},
      async listSuppliers() { return suppliers; },
      async getSupplier(_b, id) { return suppliers.find((s) => s.id === id) ?? null; },
      async createSupplier() { throw new Error("not used"); },
      async updateSupplier() { throw new Error("not used"); },
      async deleteSupplier() {},
      async listCustomersForSearch() { return []; },
      async listSuppliersForSearch() { return []; },
    },
    transactions: {
      async listSalesInvoices() { return salesInvoices; },
      async getSalesInvoice(_b, id) { return salesInvoices.find((i) => i.id === id) ?? null; },
      async createSalesInvoice(businessId, _u, header, items) {
        const invoice: SalesInvoice = {
          id: `inv-${salesInvoices.length + 1}`,
          businessId,
          invoiceNo: header.invoiceNo,
          customerId: header.customerId ?? null,
          invoiceDate: header.invoiceDate,
          dueDate: header.dueDate ?? null,
          status: header.status,
          subtotal: header.subtotal,
          discount: header.discount,
          taxTotal: header.taxTotal,
          total: header.total,
          paidAmount: header.paidAmount,
          paymentMode: header.paymentMode ?? null,
          notes: header.notes ?? null,
          items: items.map((item) => {
            const gross = item.quantity * item.unitPrice;
            const taxable = item.taxableAmount ?? Math.max(0, gross - (item.discount ?? 0));
            const tax = item.taxAmount ?? (taxable * item.gstRate) / 100;
            return {
              productId: item.productId,
              variantId: item.variantId ?? null,
              batchId: item.batchId ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              gstRate: item.gstRate,
              discount: item.discount ?? 0,
              taxableAmount: taxable,
              taxAmount: tax,
              amount: item.amount ?? taxable + tax,
              saleUnit: item.saleUnit ?? null,
              baseQuantity: item.baseQuantity ?? item.quantity,
              gstSupplyType: (item.gstSupplyType ?? null) as GstSupplyType | null,
              hsn: item.hsn ?? null,
            };
          }),
          gstDocumentType: header.gst?.gstDocumentType,
          placeOfSupplyState: header.gst?.placeOfSupplyState ?? null,
          gstRegistrationSnapshot: header.gst?.gstRegistrationSnapshot ?? null,
          intraState: header.gst?.intraState ?? true,
          reverseCharge: header.gst?.reverseCharge ?? false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        salesInvoices.push(invoice);
        return invoice;
      },
      async updateSalesInvoice(_b, invoiceId, header, items) {
        const index = salesInvoices.findIndex((i) => i.id === invoiceId);
        if (index === -1) throw new Error("Invoice not found.");
        salesInvoices[index] = {
          ...salesInvoices[index],
          customerId: header.customerId ?? null,
          invoiceDate: header.invoiceDate,
          dueDate: header.dueDate ?? null,
          status: header.status,
          subtotal: header.subtotal,
          discount: header.discount,
          taxTotal: header.taxTotal,
          total: header.total,
          paidAmount: header.paidAmount,
          paymentMode: header.paymentMode ?? null,
          notes: header.notes ?? null,
          items: items.map((item) => {
            const gross = item.quantity * item.unitPrice;
            const taxable = item.taxableAmount ?? Math.max(0, gross - (item.discount ?? 0));
            const tax = item.taxAmount ?? (taxable * item.gstRate) / 100;
            return {
              productId: item.productId,
              variantId: item.variantId ?? null,
              batchId: item.batchId ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              gstRate: item.gstRate,
              discount: item.discount ?? 0,
              taxableAmount: taxable,
              taxAmount: tax,
              amount: item.amount ?? taxable + tax,
              saleUnit: item.saleUnit ?? null,
              baseQuantity: item.baseQuantity ?? item.quantity,
              gstSupplyType: (item.gstSupplyType ?? null) as GstSupplyType | null,
              hsn: item.hsn ?? null,
            };
          }),
          gstDocumentType: header.gst?.gstDocumentType ?? salesInvoices[index].gstDocumentType,
          placeOfSupplyState: header.gst?.placeOfSupplyState ?? salesInvoices[index].placeOfSupplyState,
          gstRegistrationSnapshot: header.gst?.gstRegistrationSnapshot ?? salesInvoices[index].gstRegistrationSnapshot,
          intraState: header.gst?.intraState ?? salesInvoices[index].intraState,
          reverseCharge: header.gst?.reverseCharge ?? salesInvoices[index].reverseCharge,
          updatedAt: new Date().toISOString(),
        };
        return salesInvoices[index];
      },
      async updateSalesInvoiceStatus(_b, id, status, paidAmount) {
        const index = salesInvoices.findIndex((i) => i.id === id);
        if (index !== -1) {
          salesInvoices[index] = {
            ...salesInvoices[index],
            status,
            paidAmount: paidAmount ?? salesInvoices[index].paidAmount,
          };
        }
      },
      async deleteSalesInvoice(_b, invoiceId) {
        const index = salesInvoices.findIndex((i) => i.id === invoiceId);
        if (index !== -1) salesInvoices.splice(index, 1);
      },
      async listPurchaseOrders() { return purchaseOrders; },
      async getPurchaseOrder(_b, id) { return purchaseOrders.find((o) => o.id === id) ?? null; },
      async createPurchaseOrder(businessId, _u, header, items) {
        const order: PurchaseOrder = {
          id: `po-${purchaseOrders.length + 1}`,
          businessId,
          orderNo: header.orderNo,
          supplierId: header.supplierId ?? null,
          warehouseId: header.warehouseId ?? null,
          orderDate: header.orderDate,
          expectedDate: header.expectedDate ?? null,
          status: header.status,
          subtotal: header.subtotal,
          discount: header.discount,
          taxTotal: header.taxTotal,
          total: header.total,
          notes: header.notes ?? null,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            batchId: item.batchId ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            discount: 0,
            taxableAmount: item.quantity * item.unitPrice,
            taxAmount: item.quantity * item.unitPrice * (item.gstRate / 100),
            amount: item.quantity * item.unitPrice,
            saleUnit: item.saleUnit ?? null,
            baseQuantity: item.baseQuantity ?? item.quantity,
            receivedQuantity: 0,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        purchaseOrders.push(order);
        return order;
      },
      async applyPurchaseReceiptQuantities(_b, purchaseOrderId, items) {
        const index = purchaseOrders.findIndex((o) => o.id === purchaseOrderId);
        if (index === -1) throw new Error("Purchase order not found.");
        const nextItems = allocateReceivedQuantities(purchaseOrders[index].items, items);
        purchaseOrders[index] = {
          ...purchaseOrders[index],
          items: nextItems,
          status: receivingStatusForItems(nextItems),
        };
        return purchaseOrders[index];
      },
      async listPurchaseInvoices() { return purchaseInvoices; },
      async getPurchaseInvoice(_b, id) { return purchaseInvoices.find((i) => i.id === id) ?? null; },
      async createPurchaseInvoice(businessId, _u, header, items) {
        const invoice: PurchaseInvoice = {
          id: `purch-${purchaseInvoices.length + 1}`,
          businessId,
          billNo: header.billNo,
          supplierId: header.supplierId ?? null,
          purchaseOrderId: header.purchaseOrderId ?? null,
          invoiceDate: header.invoiceDate,
          dueDate: header.dueDate ?? null,
          status: header.status,
          subtotal: header.subtotal,
          discount: header.discount,
          taxTotal: header.taxTotal,
          total: header.total,
          paidAmount: header.paidAmount,
          notes: header.notes ?? null,
          items: items.map((item) => {
            const gross = item.quantity * item.unitPrice;
            const taxable = item.taxableAmount ?? Math.max(0, gross - (item.discount ?? 0));
            const tax = item.taxAmount ?? (taxable * item.gstRate) / 100;
            return {
              productId: item.productId,
              variantId: item.variantId ?? null,
              batchId: item.batchId ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              gstRate: item.gstRate,
              discount: item.discount ?? 0,
              taxableAmount: taxable,
              taxAmount: tax,
              amount: item.amount ?? taxable + tax,
              saleUnit: item.saleUnit ?? null,
              baseQuantity: item.baseQuantity ?? item.quantity,
              gstSupplyType: (item.gstSupplyType ?? null) as GstSupplyType | null,
              hsn: item.hsn ?? null,
            };
          }),
          gstDocumentType: header.gst?.gstDocumentType,
          placeOfSupplyState: header.gst?.placeOfSupplyState ?? null,
          supplierGstin: header.gst?.supplierGstin ?? null,
          gstRegistrationSnapshot: header.gst?.gstRegistrationSnapshot ?? null,
          intraState: header.gst?.intraState ?? true,
          reverseCharge: header.gst?.reverseCharge ?? false,
          itcEligible: header.gst?.itcEligible ?? false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        purchaseInvoices.push(invoice);
        return invoice;
      },
      async updatePurchaseInvoice(_b, invoiceId, header, items) {
        const index = purchaseInvoices.findIndex((i) => i.id === invoiceId);
        if (index === -1) throw new Error("Purchase invoice not found.");
        purchaseInvoices[index] = {
          ...purchaseInvoices[index],
          supplierId: header.supplierId ?? null,
          purchaseOrderId: header.purchaseOrderId ?? null,
          invoiceDate: header.invoiceDate,
          dueDate: header.dueDate ?? null,
          status: header.status,
          subtotal: header.subtotal,
          discount: header.discount,
          taxTotal: header.taxTotal,
          total: header.total,
          paidAmount: header.paidAmount,
          notes: header.notes ?? null,
          items: items.map((item) => {
            const gross = item.quantity * item.unitPrice;
            const taxable = item.taxableAmount ?? Math.max(0, gross - (item.discount ?? 0));
            const tax = item.taxAmount ?? (taxable * item.gstRate) / 100;
            return {
              productId: item.productId,
              variantId: item.variantId ?? null,
              batchId: item.batchId ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              gstRate: item.gstRate,
              discount: item.discount ?? 0,
              taxableAmount: taxable,
              taxAmount: tax,
              amount: item.amount ?? taxable + tax,
              saleUnit: item.saleUnit ?? null,
              baseQuantity: item.baseQuantity ?? item.quantity,
              gstSupplyType: (item.gstSupplyType ?? null) as GstSupplyType | null,
              hsn: item.hsn ?? null,
            };
          }),
          gstDocumentType: header.gst?.gstDocumentType ?? purchaseInvoices[index].gstDocumentType,
          placeOfSupplyState: header.gst?.placeOfSupplyState ?? purchaseInvoices[index].placeOfSupplyState,
          supplierGstin: header.gst?.supplierGstin ?? purchaseInvoices[index].supplierGstin,
          gstRegistrationSnapshot: header.gst?.gstRegistrationSnapshot ?? purchaseInvoices[index].gstRegistrationSnapshot,
          intraState: header.gst?.intraState ?? purchaseInvoices[index].intraState,
          reverseCharge: header.gst?.reverseCharge ?? purchaseInvoices[index].reverseCharge,
          itcEligible: header.gst?.itcEligible ?? purchaseInvoices[index].itcEligible,
          updatedAt: new Date().toISOString(),
        };
        return purchaseInvoices[index];
      },
      async updatePurchaseInvoiceStatus(_b, id, status, paidAmount) {
        const index = purchaseInvoices.findIndex((i) => i.id === id);
        if (index !== -1) {
          purchaseInvoices[index] = {
            ...purchaseInvoices[index],
            status,
            paidAmount: paidAmount ?? purchaseInvoices[index].paidAmount,
          };
        }
      },
      async deletePurchaseInvoice(_b, invoiceId) {
        const index = purchaseInvoices.findIndex((i) => i.id === invoiceId);
        if (index !== -1) purchaseInvoices.splice(index, 1);
      },
      async listPayments() { return payments as never[]; },
      async getPayment(_b, paymentId) {
        return (payments.find((p) => p.id === paymentId) ?? null) as never;
      },
      async cancelPayment(_b, userId, paymentId) {
        const payment = payments.find((p) => p.id === paymentId);
        if (!payment) throw new Error("Payment not found.");
        Object.assign(payment, { status: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: userId });
        return payment as never;
      },
      async cancelPaymentsForDocument(_b, userId, input) {
        for (const payment of payments) {
          const matches = input.salesInvoiceId
            ? payment.salesInvoiceId === input.salesInvoiceId
              || (payment.allocations ?? []).some((row: { salesInvoiceId?: string | null }) => row.salesInvoiceId === input.salesInvoiceId)
            : input.purchaseInvoiceId
              ? payment.purchaseInvoiceId === input.purchaseInvoiceId
                || (payment.allocations ?? []).some((row: { purchaseInvoiceId?: string | null }) => row.purchaseInvoiceId === input.purchaseInvoiceId)
              : false;
          if (matches) Object.assign(payment, { status: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: userId });
        }
      },
      async deletePaymentsForDocument(_b, input) {
        for (const payment of payments) {
          const matches = input.salesInvoiceId
            ? payment.salesInvoiceId === input.salesInvoiceId
            : input.purchaseInvoiceId
              ? payment.purchaseInvoiceId === input.purchaseInvoiceId
              : false;
          if (matches) Object.assign(payment, { status: "cancelled" });
        }
      },
      async createPayment(_b, _u, input) {
        const id = `pay-${payments.length + 1}`;
        const allocations = (input.allocations ?? []).filter((row: { amount: number }) => row.amount > 0).map((row: { salesInvoiceId?: string | null; purchaseInvoiceId?: string | null; amount: number }, index: number) => ({
          id: `${id}-${index}`,
          businessId: _b,
          paymentId: id,
          salesInvoiceId: row.salesInvoiceId ?? null,
          purchaseInvoiceId: row.purchaseInvoiceId ?? null,
          amount: row.amount,
          createdAt: new Date().toISOString(),
        }));
        const payment = {
          id,
          businessId: _b,
          documentNo: input.documentNo ?? `PAY-${payments.length + 1}`,
          direction: input.direction,
          partyType: input.partyType,
          partyId: input.partyId ?? null,
          salesInvoiceId: input.salesInvoiceId ?? null,
          purchaseInvoiceId: input.purchaseInvoiceId ?? null,
          amount: input.amount,
          mode: input.mode,
          reference: input.reference ?? null,
          paymentDate: input.paymentDate,
          notes: input.notes ?? null,
          status: "posted",
          cancelledAt: null,
          cancelledBy: null,
          allocations,
          createdAt: new Date().toISOString(),
        };
        payments.push(payment);
        return payment as never;
      },
      async listPaymentModes(_b) { return paymentModes.filter((m) => m.businessId === _b); },
      async createPaymentMode(_b, input) {
        const mode = { id: `m-${paymentModes.length + 1}`, businessId: _b, code: input.code, name: input.name, isActive: true, sortOrder: input.sortOrder ?? 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        paymentModes.push(mode);
        return mode;
      },
      async updatePaymentMode(_b, id, input) {
        const index = paymentModes.findIndex((m) => m.id === id);
        if (index !== -1) paymentModes[index] = { ...paymentModes[index], ...input };
        return paymentModes[index];
      },
      async nextDocumentNumber(_b, kind, prefix) {
        const key = `${_b}:${kind}`;
        const next = (sequences.get(key) ?? 0) + 1;
        sequences.set(key, next);
        return `${prefix.toUpperCase()}-${new Date().getFullYear()}-${String(next).padStart(6, "0")}`;
      },
      async createPurchaseReceipt(_b, _u, input, items) {
        const receipt = { id: `rcpt-${receipts.length + 1}`, businessId: _b, ...input, items, createdAt: new Date().toISOString() };
        receipts.push(receipt);
        return receipt as never;
      },
      async listPurchaseReceipts() { return receipts as never[]; },
      async createPurchaseReturn(_b, _u, input, items) {
        const result = { id: `pr-${purchaseReturns.length + 1}`, businessId: _b, ...input, items, createdAt: new Date().toISOString() };
        purchaseReturns.push(result);
        return result as never;
      },
      async listPurchaseReturns() { return purchaseReturns as never[]; },
      async createSalesReturn(_b, _u, input, items) {
        const result = { id: `sr-${salesReturns.length + 1}`, businessId: _b, ...input, items, createdAt: new Date().toISOString() };
        salesReturns.push(result);
        return result as never;
      },
      async listSalesReturns() { return salesReturns as never[]; },
      async listSalesInvoicesForSearch() { return []; },
      async listPurchaseInvoicesForSearch() { return []; },
    },
    notifications: {
      async list() { return []; },
      async create() {
        return { id: "n-1", businessId: "b-1", userId: null, title: "Low stock", type: "warning", read: false, timestamp: new Date().toISOString() };
      },
      async markRead() {},
      async markAllRead() {},
    },
    audits: {
      async create(input) {
        const event: AuditEvent = {
          id: `a-${auditLogs.length + 1}`,
          businessId: input.businessId ?? null,
          userId: input.userId ?? null,
          action: input.action,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          metadata: input.metadata ?? {},
          createdAt: new Date().toISOString(),
        };
        auditLogs.unshift(event);
        return event;
      },
      async list(businessId) {
        return auditLogs.filter((log) => log.businessId === businessId);
      },
    },
    businesses: {
      async listForUser() { return []; },
      async getById(businessId) {
        const business: BusinessProfile = {
          id: businessId,
          name: "Test Business",
          legalName: null,
          type: "retail",
          logoUrl: null,
          address: null,
          city: null,
          state: "Maharashtra",
          country: "India",
          pincode: null,
          phone: null,
          email: null,
          website: null,
          gstin: "27ABCDE1234F1Z5",
          pan: null,
          gstRegistrationType: "regular",
          currency: "INR",
          financialYear: "2026-2027",
          invoicePrefix: "SAL",
          invoiceStartNumber: 1,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return business;
      },
      async getByUserAndId() { return null; },
      async create() { throw new Error("not used"); },
      async update() { throw new Error("not used"); },
      async getSetting(businessId, key) { return settings.get(`${businessId}:${key}`) ?? null; },
      async setSetting(businessId, key, value, _userId) { settings.set(`${businessId}:${key}`, value); },
    },
    profiles: {
      async getByUserId() { return null; },
      async update() { throw new Error("not used"); },
      async isUsernameAvailable() { return true; },
      async upsertOwnProfile() { throw new Error("not used"); },
    },
    team: {
      async listMembers() { return []; },
      async listRoles() { return []; },
      async listPermissions() { return []; },
      async listRolePermissions() { return []; },
      async listInvitations() { return []; },
      async createInvitation() { throw new Error("not used"); },
      async cancelInvitation() {},
      async updateMemberRole() {},
      async removeMember() {},
      async getMemberPermissions() { return [...memberPermissions]; },
    },
  };

  return { repos, products, ledger, salesInvoices, purchaseInvoices, purchaseOrders, payments, auditLogs, batches, settings, memberPermissions, suppliers };
}

describe("TransactionService", () => {
  let services: ReturnType<typeof memoryRepositories>;
  let transactions: TransactionService;

  beforeEach(() => {
    services = memoryRepositories();
    transactions = new TransactionService(
      services.repos,
      new AuditService(services.repos),
      new NotificationService(services.repos)
    );
  });

  async function seedProduct() {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Item",
      gstRate: 18,
      purchasePrice: 100,
      salePrice: 200,
      lowStockThreshold: 5,
    });
    return product;
  }

  it("creates a fully-paid sales invoice and writes SALE stock movements", async () => {
    const product = await seedProduct();
    const { invoice, totals } = await transactions.createSalesInvoice(
      "b-1",
      "u-1",
      "SAL-2026-000001",
      {
        items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 18 }],
        payments: [{ mode: "cash", amount: 472 }],
      }
    );

    expect(invoice.status).toBe("paid");
    expect(invoice.paidAmount).toBe(472);
    expect(totals.total).toBe(472);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -2, movementType: "SALE" })
    );
    expect(services.payments).toHaveLength(1);
  });

  it("marks a credit sale as completed with zero paid", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000002", {
      customerId: "c-1",
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      payments: [],
    });
    expect(invoice.status).toBe("completed");
    expect(invoice.paidAmount).toBe(0);
  });

  it("rejects non-cash payment above the invoice total", async () => {
    const product = await seedProduct();
    await expect(
      transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000003", {
        items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
        payments: [{ mode: "upi", amount: 9999 }],
      })
    ).rejects.toThrow(AppError);
  });

  it("treats extra cash as change and records payment equal to the total", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000011", {
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      payments: [{ mode: "cash", amount: 300 }],
    });
    expect(invoice.status).toBe("paid");
    expect(invoice.paidAmount).toBe(236);
    expect(services.payments).toEqual([
      expect.objectContaining({ mode: "cash", amount: 236 }),
    ]);
  });

  it("applies item and invoice discounts before GST on a sale", async () => {
    const product = await seedProduct();
    const { totals, invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000006", {
      items: [{ productId: product.id, quantity: 1, unitPrice: 500, gstRate: 18, discount: 20 }],
      discount: 30,
      payments: [{ mode: "cash", amount: 531 }],
    });
    expect(totals.taxableAmount).toBe(450);
    expect(totals.taxAmount).toBe(81);
    expect(totals.total).toBe(531);
    expect(invoice.total).toBe(531);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -1, movementType: "SALE" })
    );
  });

  it("extracts GST from inclusive selling prices when tax settings say so", async () => {
    const product = await seedProduct();
    await services.repos.businesses.setSetting("b-1", "tax.defaults", {
      gstEnabled: true,
      defaultGstRate: 18,
      defaultIntraState: true,
      defaultHsnCode: "",
      pricesIncludeTax: true,
    }, "u-1");
    const { totals, invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000013", {
      items: [{ productId: product.id, quantity: 1, unitPrice: 118, gstRate: 18 }],
      payments: [{ mode: "cash", amount: 118 }],
    });
    expect(totals.taxableAmount).toBe(100);
    expect(totals.taxAmount).toBe(18);
    expect(totals.total).toBe(118);
    expect(invoice.total).toBe(118);
    expect(invoice.taxTotal).toBe(18);
  });

  it("keeps exclusive GST after settings change does not rewrite a prior invoice", async () => {
    const product = await seedProduct();
    const first = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000014", {
      items: [{ productId: product.id, quantity: 1, unitPrice: 100, gstRate: 18 }],
      payments: [{ mode: "cash", amount: 118 }],
    });
    expect(first.totals.total).toBe(118);
    await services.repos.businesses.setSetting("b-1", "tax.defaults", {
      gstEnabled: true,
      defaultGstRate: 18,
      defaultIntraState: true,
      defaultHsnCode: "",
      pricesIncludeTax: true,
    }, "u-1");
    const second = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000015", {
      asDraft: true,
      items: [{ productId: product.id, quantity: 1, unitPrice: 118, gstRate: 18 }],
    });
    expect(first.invoice.total).toBe(118);
    expect(first.invoice.taxTotal).toBe(18);
    expect(second.totals.taxableAmount).toBe(100);
    expect(second.totals.total).toBe(118);
  });

  it("extracts GST from inclusive purchase prices when tax settings say so", async () => {
    const product = await seedProduct();
    await services.repos.businesses.setSetting("b-1", "tax.defaults", {
      gstEnabled: true,
      defaultGstRate: 18,
      defaultIntraState: true,
      defaultHsnCode: "",
      pricesIncludeTax: true,
    }, "u-1");
    const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000050", {
      items: [{ productId: product.id, quantity: 1, unitPrice: 118, gstRate: 18 }],
    });
    expect(invoice.subtotal).toBe(100);
    expect(invoice.taxTotal).toBe(18);
    expect(invoice.total).toBe(118);
  });

  it("scopes inclusive tax to the business that saved the setting", async () => {
    const productA = await seedProduct();
    const productB = await services.repos.products.createProduct("b-2", "u-1", {
      name: "Other",
      gstRate: 18,
      purchasePrice: 100,
      salePrice: 200,
      lowStockThreshold: 5,
    });
    await services.repos.businesses.setSetting("b-1", "tax.defaults", {
      gstEnabled: true,
      defaultGstRate: 18,
      defaultIntraState: true,
      defaultHsnCode: "",
      pricesIncludeTax: true,
    }, "u-1");
    const inclusive = await transactions.createSalesInvoice("b-1", "u-1", "SAL-B1-000001", {
      asDraft: true,
      items: [{ productId: productA.id, quantity: 1, unitPrice: 118, gstRate: 18 }],
    });
    const exclusive = await transactions.createSalesInvoice("b-2", "u-1", "SAL-B2-000001", {
      asDraft: true,
      items: [{ productId: productB.id, quantity: 1, unitPrice: 100, gstRate: 18 }],
    });
    expect(inclusive.totals.taxableAmount).toBe(100);
    expect(inclusive.totals.total).toBe(118);
    expect(exclusive.totals.taxableAmount).toBe(100);
    expect(exclusive.totals.total).toBe(118);
    expect(exclusive.totals.taxAmount).toBe(18);
  });

  it("saves a draft sales invoice without stock movements or payments", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000007", {
      walkInName: "Counter guest",
      asDraft: true,
      items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 18 }],
      payments: [{ mode: "cash", amount: 472 }],
    });
    expect(invoice.status).toBe("draft");
    expect(invoice.paidAmount).toBe(0);
    expect(invoice.notes).toContain("Walk-in: Counter guest");
    expect(services.ledger).toHaveLength(0);
    expect(services.payments).toHaveLength(0);
  });

  it("completes a draft sales invoice and records stock OUT", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000008", {
      asDraft: true,
      items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 18 }],
    });
    expect(services.ledger).toHaveLength(0);
    const completed = await transactions.completeSalesInvoice("b-1", "u-1", invoice.id);
    expect(completed.status).toBe("completed");
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -2, movementType: "SALE" })
    );
  });

  it("does not restore stock when deleting a draft sale", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000009", {
      asDraft: true,
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
    });
    await transactions.deleteSalesInvoice("b-1", "u-1", invoice.id);
    expect(services.ledger).toHaveLength(0);
    expect(services.salesInvoices.find((row) => row.id === invoice.id)).toBeUndefined();
  });

  it("rejects payment against a draft sales invoice", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000010", {
      asDraft: true,
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
    });
    await expect(
      transactions.createPayment("b-1", "u-1", {
        direction: "in",
        partyType: "customer",
        salesInvoiceId: invoice.id,
        amount: 50,
        mode: "cash",
      })
    ).rejects.toThrow(AppError);
  });

  it("creates a purchase invoice with PURCHASE stock-in", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000001", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 10, unitPrice: 100, gstRate: 18 }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 10, movementType: "PURCHASE" })
    );
    expect(services.purchaseInvoices[0].status).toBe("unpaid");
  });

  it("saves the screenshot purchase case with batch, GST 5%, and stock IN once", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "NON VEG CHUNKIES UNDER 1 YEAR 10 KG",
      unit: "KG",
      packUnit: "BAG",
      unitsPerPack: 10,
      allowPackPurchase: true,
      gstRate: 5,
      purchasePrice: 140,
      salePrice: 180,
    });
    const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "BILL-2026-000001", {
      supplierId: "s-1",
      notes: "Vendor invoice: HG3456",
      items: [{
        productId: product.id,
        quantity: 10,
        unitKind: "pack",
        rateBasis: "base",
        unitPrice: 140,
        gstRate: 5,
        batchNo: "GH6478",
      }],
    });
    expect(invoice.subtotal).toBe(14000);
    expect(invoice.taxTotal).toBe(700);
    expect(invoice.total).toBe(14700);
    expect(invoice.status).toBe("unpaid");
    expect(invoice.items[0]).toMatchObject({ quantity: 10, saleUnit: "BAG", baseQuantity: 100, batchId: services.batches[0].id });
    expect(services.batches[0]).toMatchObject({ batchNo: "GH6478", purchasePrice: 140 });
    expect(services.ledger.filter((row) => row.productId === product.id && row.movementType === "PURCHASE")).toHaveLength(1);
    expect(services.ledger[0]).toMatchObject({ change: 100, batchId: services.batches[0].id });
  });

  it("saves a minimal purchase when optional batch fields are empty", async () => {
    const product = await seedProduct();
    const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000040", {
      items: [{ productId: product.id, quantity: 1, unitPrice: 50, gstRate: 0 }],
    });
    expect(invoice.items[0].batchId).toBeNull();
    expect(services.batches).toHaveLength(0);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 1, movementType: "PURCHASE", batchId: null })
    );
  });

  it("saves a draft purchase invoice without stock movements", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000002", {
      supplierId: "s-1",
      asDraft: true,
      items: [{ productId: product.id, quantity: 10, unitPrice: 100, gstRate: 18 }],
    });
    expect(services.purchaseInvoices[0].status).toBe("draft");
    expect(services.ledger).toHaveLength(0);
  });

  it("completes a draft purchase invoice and records stock IN", async () => {
    const product = await seedProduct();
    const draft = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000003", {
      supplierId: "s-1",
      asDraft: true,
      items: [{ productId: product.id, quantity: 6, unitPrice: 80, gstRate: 18 }],
    });
    expect(services.ledger).toHaveLength(0);

    const completed = await transactions.completePurchaseInvoice("b-1", "u-1", draft.id, "wh-1");
    expect(completed.status).toBe("unpaid");
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 6, movementType: "PURCHASE" })
    );
  });

  it("does not double-apply stock when completing an already unpaid bill", async () => {
    const product = await seedProduct();
    const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000004", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 3, unitPrice: 50, gstRate: 5 }],
    });
    expect(services.ledger).toHaveLength(1);
    await transactions.completePurchaseInvoice("b-1", "u-1", invoice.id);
    expect(services.ledger).toHaveLength(1);
  });

  it("rejects payment against a draft purchase invoice", async () => {
    const product = await seedProduct();
    const draft = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000005", {
      supplierId: "s-1",
      asDraft: true,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100, gstRate: 0 }],
    });
    await expect(
      transactions.createPayment("b-1", "u-1", {
        direction: "out",
        partyType: "supplier",
        partyId: "s-1",
        purchaseInvoiceId: draft.id,
        amount: 50,
        mode: "cash",
      })
    ).rejects.toThrow(AppError);
    expect(services.ledger).toHaveLength(0);
  });

  it("receives goods and increases stock", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseReceipt("b-1", "u-1", "RCT-2026-000001", {
      warehouseId: "wh-1",
      items: [{ productId: product.id, quantity: 25, unitCost: 90 }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 25, movementType: "PURCHASE" })
    );
    expect(services.auditLogs[0].action).toBe("purchase_received");
  });

  it("partially receives a purchase order then completes remaining qty", async () => {
    const product = await seedProduct();
    const order = await transactions.createPurchaseOrder("b-1", "u-1", "PO-2026-000001", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 10, unitPrice: 80, gstRate: 18 }],
    });
    await transactions.createPurchaseReceipt("b-1", "u-1", "RCT-2026-000002", {
      purchaseOrderId: order.id,
      warehouseId: "wh-1",
      items: [{ productId: product.id, quantity: 4, unitCost: 80 }],
    });
    expect(services.purchaseOrders[0].status).toBe("partial");
    expect(services.purchaseOrders[0].items[0].receivedQuantity).toBe(4);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 4, movementType: "PURCHASE" })
    );

    await transactions.createPurchaseReceipt("b-1", "u-1", "RCT-2026-000003", {
      purchaseOrderId: order.id,
      warehouseId: "wh-1",
      items: [{ productId: product.id, quantity: 6, unitCost: 80 }],
    });
    expect(services.purchaseOrders[0].status).toBe("received");
    expect(services.purchaseOrders[0].items[0].receivedQuantity).toBe(10);
  });

  it("rejects receiving more than remaining ordered quantity", async () => {
    const product = await seedProduct();
    const order = await transactions.createPurchaseOrder("b-1", "u-1", "PO-2026-000002", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 5, unitPrice: 50, gstRate: 0 }],
    });
    await transactions.createPurchaseReceipt("b-1", "u-1", "RCT-2026-000004", {
      purchaseOrderId: order.id,
      items: [{ productId: product.id, quantity: 3, unitCost: 50 }],
    });
    await expect(
      transactions.createPurchaseReceipt("b-1", "u-1", "RCT-2026-000005", {
        purchaseOrderId: order.id,
        items: [{ productId: product.id, quantity: 3, unitCost: 50 }],
      })
    ).rejects.toThrow(AppError);
    expect(services.purchaseOrders[0].items[0].receivedQuantity).toBe(3);
    expect(services.ledger.filter((entry) => entry.productId === product.id)).toHaveLength(1);
  });

  it("ignores zero-qty lines and still records a partial receipt", async () => {
    const product = await seedProduct();
    const other = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Other",
      gstRate: 0,
      purchasePrice: 10,
      salePrice: 20,
      lowStockThreshold: 1,
    });
    const order = await transactions.createPurchaseOrder("b-1", "u-1", "PO-2026-000003", {
      items: [
        { productId: product.id, quantity: 8, unitPrice: 40, gstRate: 0 },
        { productId: other.id, quantity: 2, unitPrice: 10, gstRate: 0 },
      ],
    });
    await transactions.createPurchaseReceipt("b-1", "u-1", "RCT-2026-000006", {
      purchaseOrderId: order.id,
      items: [
        { productId: product.id, quantity: 5, unitCost: 40 },
        { productId: other.id, quantity: 0, unitCost: 10 },
      ],
    });
    expect(services.purchaseOrders[0].status).toBe("partial");
    expect(services.purchaseOrders[0].items.find((item) => item.productId === product.id)?.receivedQuantity).toBe(5);
    expect(services.purchaseOrders[0].items.find((item) => item.productId === other.id)?.receivedQuantity).toBe(0);
  });

  it("records a purchase return that sends stock out", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseReturn("b-1", "u-1", "PRT-2026-000001", {
      purchaseInvoiceId: "purch-1",
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 4, unitCost: 100 }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -4, movementType: "PURCHASE_RETURN" })
    );
  });

  it("records a sales return that restores stock and marks the invoice returned", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000004", {
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      payments: [{ mode: "cash", amount: 236 }],
    });
    await transactions.createSalesReturn("b-1", "u-1", "SRT-2026-000001", {
      salesInvoiceId: invoice.id,
      customerId: "c-1",
      items: [{ productId: product.id, quantity: 1, unitPrice: 200 }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 1, movementType: "SALE_RETURN" })
    );
    expect(services.salesInvoices.find((i) => i.id === invoice.id)?.status).toBe("returned");
  });

  it("keeps a partial sales return from marking the invoice returned", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000012", {
      items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 18 }],
      payments: [{ mode: "cash", amount: 472 }],
    });
    await transactions.createSalesReturn("b-1", "u-1", "SRT-2026-000004", {
      salesInvoiceId: invoice.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 200 }],
    });
    expect(services.salesInvoices.find((i) => i.id === invoice.id)?.status).toBe("paid");
    await expect(
      transactions.createSalesReturn("b-1", "u-1", "SRT-2026-000005", {
        salesInvoiceId: invoice.id,
        items: [{ productId: product.id, quantity: 2, unitPrice: 200 }],
      })
    ).rejects.toThrow(AppError);
  });

  it("rejects a sales return without the original invoice", async () => {
    const product = await seedProduct();
    await expect(
      transactions.createSalesReturn("b-1", "u-1", "SRT-2026-000006", {
        items: [{ productId: product.id, quantity: 1, unitPrice: 200 }],
      })
    ).rejects.toThrow(AppError);
  });

  it("applies a payment and reconciles the invoice to partial then paid", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000005", {
      customerId: "c-1",
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      payments: [],
    });
    await transactions.createPayment("b-1", "u-1", {
      direction: "in",
      partyType: "customer",
      salesInvoiceId: invoice.id,
      amount: 100,
      mode: "cash",
    });
    expect(services.salesInvoices.find((i) => i.id === invoice.id)?.status).toBe("partial");
    await transactions.createPayment("b-1", "u-1", {
      direction: "in",
      partyType: "customer",
      salesInvoiceId: invoice.id,
      amount: 136,
      mode: "upi",
    });
    expect(services.salesInvoices.find((i) => i.id === invoice.id)?.status).toBe("paid");
  });

  it("allocates one receipt across two invoices and keeps surplus as an advance", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000020", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 10, unitPrice: 100, gstRate: 0 }],
    });
    const first = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000013", {
      customerId: "c-1",
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      payments: [],
    });
    const second = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000014", {
      customerId: "c-1",
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      payments: [],
    });
    const payment = await transactions.createPayment("b-1", "u-1", {
      direction: "in",
      partyType: "customer",
      partyId: "c-1",
      amount: 300,
      mode: "cash",
      allocations: [
        { salesInvoiceId: first.invoice.id, amount: 236 },
        { salesInvoiceId: second.invoice.id, amount: 50 },
      ],
    });
    expect(services.salesInvoices.find((i) => i.id === first.invoice.id)?.status).toBe("paid");
    expect(services.salesInvoices.find((i) => i.id === second.invoice.id)?.status).toBe("partial");
    expect(payment.allocations).toHaveLength(2);
    expect(payment.amount).toBe(300);
  });

  it("cancels a payment and restores the invoice outstanding", async () => {
    const product = await seedProduct();
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000015", {
      customerId: "c-1",
      items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      payments: [],
    });
    const payment = await transactions.createPayment("b-1", "u-1", {
      direction: "in",
      partyType: "customer",
      partyId: "c-1",
      salesInvoiceId: invoice.id,
      amount: 236,
      mode: "cash",
    });
    expect(services.salesInvoices.find((i) => i.id === invoice.id)?.status).toBe("paid");
    await transactions.cancelPayment("b-1", "u-1", payment.id);
    expect(services.payments.find((p) => p.id === payment.id)?.status).toBe("cancelled");
    expect(services.salesInvoices.find((i) => i.id === invoice.id)?.status).toBe("completed");
    expect(services.salesInvoices.find((i) => i.id === invoice.id)?.paidAmount).toBe(0);
  });

  it("lists and creates payment modes", async () => {
    const modes = await transactions.listPaymentModes("b-1");
    expect(modes).toHaveLength(2);
    await transactions.createPaymentMode("b-1", "u-1", { code: "cheque", name: "Cheque" });
    expect(await transactions.listPaymentModes("b-1")).toHaveLength(3);
  });

  it("persists purchase MRP onto a batch and stocks IN with that batchId", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000010", {
      supplierId: "s-1",
      warehouseId: "wh-1",
      items: [{
        productId: product.id,
        quantity: 12,
        unitPrice: 80,
        gstRate: 12,
        batchNo: "B-LOT-1",
        expiryDate: "2027-01-31",
        mrp: 150,
      }],
    });
    expect(services.batches).toHaveLength(1);
    expect(services.batches[0]).toMatchObject({
      batchNo: "B-LOT-1",
      expiryDate: "2027-01-31",
      mrp: 150,
      purchasePrice: 80,
    });
    expect(services.purchaseInvoices[0].items[0].batchId).toBe(services.batches[0].id);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({
        productId: product.id,
        change: 12,
        movementType: "PURCHASE",
        batchId: services.batches[0].id,
        warehouseId: "wh-1",
      })
    );
  });

  it("sells from the selected batch and writes SALE against that lot", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000011", {
      supplierId: "s-1",
      items: [{
        productId: product.id,
        quantity: 10,
        unitPrice: 90,
        gstRate: 12,
        batchNo: "LOT-A",
        mrp: 200,
      }],
    });
    const batchId = services.batches[0].id;
    const { invoice, totals } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000020", {
      warehouseId: "wh-1",
      items: [{
        productId: product.id,
        batchId,
        quantity: 2,
        unitPrice: 180,
        gstRate: 12,
        mrp: 200,
      }],
      payments: [{ mode: "cash", amount: 403.2 }],
    });
    expect(invoice.items[0].batchId).toBe(batchId);
    expect(totals.taxableAmount).toBe(360);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -2, movementType: "SALE", batchId })
    );
  });

  it("converts purchase pack qty to base-unit stock IN", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 12,
      purchasePrice: 80,
      salePrice: 100,
    });
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000012", {
      supplierId: "s-1",
      items: [{
        productId: product.id,
        quantity: 5,
        unitKind: "pack",
        unitPrice: 80,
        gstRate: 12,
        batchNo: "STRIP-1",
        mrp: 120,
      }],
    });
    expect(services.purchaseInvoices[0].items[0]).toMatchObject({
      quantity: 5,
      saleUnit: "STRIP",
      baseQuantity: 50,
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 50, movementType: "PURCHASE" })
    );
  });

  it("sells pack qty as base-unit stock OUT and GST on sale price", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 12,
      purchasePrice: 80,
      salePrice: 100,
    });
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000013", {
      supplierId: "s-1",
      items: [{
        productId: product.id,
        quantity: 20,
        unitKind: "base",
        unitPrice: 8,
        gstRate: 12,
        batchNo: "LOT-P",
        mrp: 15,
      }],
    });
    const batchId = services.batches[0].id;
    const { invoice, totals } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000022", {
      items: [{
        productId: product.id,
        batchId,
        quantity: 2,
        unitKind: "pack",
        unitPrice: 100,
        gstRate: 12,
        mrp: 150,
      }],
      payments: [{ mode: "cash", amount: 224 }],
    });
    expect(invoice.items[0]).toMatchObject({ quantity: 2, saleUnit: "STRIP", baseQuantity: 20, batchId });
    expect(totals.taxableAmount).toBe(200);
    expect(totals.taxAmount).toBe(24);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -20, movementType: "SALE", batchId })
    );
  });

  it("rejects selling more than available base units", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 8,
      salePrice: 12,
    });
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000014", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 14, unitKind: "base", unitPrice: 8, gstRate: 0 }],
    });
    await expect(
      transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000023", {
        items: [{ productId: product.id, quantity: 2, unitKind: "pack", unitPrice: 100, gstRate: 0 }],
        payments: [{ mode: "cash", amount: 200 }],
      })
    ).rejects.toThrow(/Only 14 PCS available/);
  });

  it("keeps GST and MRP on commercial sale qty while stock uses base units", async () => {
    const product = await seedProduct();
    const { invoice, totals } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000024", {
      items: [{ productId: product.id, quantity: 2, unitPrice: 180, gstRate: 12, mrp: 200 }],
      payments: [{ mode: "cash", amount: 403.2 }],
    });
    expect(invoice.items[0].quantity).toBe(2);
    expect(invoice.items[0].baseQuantity).toBe(2);
    expect(totals.taxableAmount).toBe(360);
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -2, movementType: "SALE" })
    );
  });

  it("rejects a sale price above MRP", async () => {
    const product = await seedProduct();
    await expect(
      transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000021", {
        items: [{ productId: product.id, quantity: 1, unitPrice: 250, gstRate: 18, mrp: 200 }],
        payments: [{ mode: "cash", amount: 295 }],
      })
    ).rejects.toThrow(AppError);
  });

  it("purchases 1 STRIP at Rs 5 per PCS as 10 PCS and Rs 50", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 5,
      salePrice: 8,
    });
    const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000020", {
      supplierId: "s-1",
      items: [{
        productId: product.id,
        quantity: 1,
        unitKind: "pack",
        rateBasis: "base",
        unitPrice: 5,
        gstRate: 0,
        batchNo: "LOT-R5",
        mrp: 12,
      }],
    });
    expect(invoice.subtotal).toBe(50);
    expect(invoice.items[0]).toMatchObject({ quantity: 1, saleUnit: "STRIP", baseQuantity: 10 });
    expect(services.batches[0]).toMatchObject({ mrp: 12, purchasePrice: 5 });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 10, movementType: "PURCHASE" })
    );
  });

  it("does not multiply a per-STRIP rate by pack size", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 5,
      salePrice: 8,
    });
    const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000021", {
      supplierId: "s-1",
      items: [{
        productId: product.id,
        quantity: 1,
        unitKind: "pack",
        rateBasis: "pack",
        unitPrice: 50,
        gstRate: 0,
        batchNo: "LOT-R50",
      }],
    });
    expect(invoice.subtotal).toBe(50);
    expect(invoice.items[0].baseQuantity).toBe(10);
    expect(services.batches[0].purchasePrice).toBe(5);
  });

  it("sells 1 STRIP then 2 PCS from 110 remaining 98", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 5,
      salePrice: 8,
    });
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000022", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 110, unitKind: "base", unitPrice: 5, gstRate: 0, batchNo: "LOT-110" }],
    });
    const batchId = services.batches[0].id;
    await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000030", {
      items: [{ productId: product.id, batchId, quantity: 1, unitKind: "pack", unitPrice: 80, gstRate: 0 }],
      payments: [{ mode: "cash", amount: 80 }],
    });
    await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000031", {
      items: [{ productId: product.id, batchId, quantity: 2, unitKind: "base", unitPrice: 8, gstRate: 0 }],
      payments: [{ mode: "cash", amount: 16 }],
    });
    const remaining = services.ledger
      .filter((entry) => entry.productId === product.id)
      .reduce((sum, entry) => sum + entry.change, 0);
    expect(remaining).toBe(98);
  });

  it("loads batch MRP independently for lot A and lot B", async () => {
    const product = await seedProduct();
    await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000023", {
      supplierId: "s-1",
      items: [
        { productId: product.id, quantity: 10, unitPrice: 80, gstRate: 0, batchNo: "A", mrp: 120 },
        { productId: product.id, quantity: 10, unitPrice: 90, gstRate: 0, batchNo: "B", mrp: 150 },
      ],
    });
    expect(services.batches.find((batch) => batch.batchNo === "A")?.mrp).toBe(120);
    expect(services.batches.find((batch) => batch.batchNo === "B")?.mrp).toBe(150);
  });

  it("converts purchase return pack qty to base-unit stock OUT", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 5,
      salePrice: 8,
    });
    await transactions.createPurchaseReturn("b-1", "u-1", "PRT-2026-000002", {
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 1, unitCost: 50, unitKind: "pack" }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: -10, movementType: "PURCHASE_RETURN" })
    );
  });

  it("converts sales return pack qty to base-unit stock IN", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 10,
      allowBaseSale: true,
      allowPackSale: true,
      gstRate: 0,
      purchasePrice: 5,
      salePrice: 8,
    });
    const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000050", {
      items: [{ productId: product.id, quantity: 1, unitPrice: 80, gstRate: 0, unitKind: "pack" }],
      payments: [{ mode: "cash", amount: 80 }],
    });
    await transactions.createSalesReturn("b-1", "u-1", "SRT-2026-000002", {
      salesInvoiceId: invoice.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 80, unitKind: "pack" }],
    });
    expect(services.ledger).toContainEqual(
      expect.objectContaining({ productId: product.id, change: 10, movementType: "SALE_RETURN" })
    );
  });

  it("keeps one minor-unit ledger for 1 STRIP = 15 PCS purchase, sale and return", async () => {
    const product = await services.repos.products.createProduct("b-1", "u-1", {
      name: "Tablet",
      unit: "PCS",
      packUnit: "STRIP",
      unitsPerPack: 15,
      allowBaseSale: true,
      allowPackSale: true,
      allowPackPurchase: true,
      fixedPacking: true,
      gstRate: 0,
      purchasePrice: 10,
      salePrice: 12,
    });
    const perMajor = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000030", {
      supplierId: "s-1",
      items: [{
        productId: product.id,
        quantity: 10,
        unitKind: "pack",
        rateBasis: "pack",
        unitPrice: 150,
        gstRate: 0,
        batchNo: "LOT-15",
        mrp: 200,
      }],
    });
    const perMinor = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-2026-000031", {
      supplierId: "s-1",
      asDraft: true,
      items: [{
        productId: product.id,
        quantity: 10,
        unitKind: "pack",
        rateBasis: "base",
        unitPrice: 10,
        gstRate: 0,
        batchNo: "LOT-15B",
        mrp: 200,
      }],
    });
    expect(perMajor.subtotal).toBe(1500);
    expect(perMinor.subtotal).toBe(1500);
    expect(perMajor.items[0].baseQuantity).toBe(150);
    expect(services.batches.find((batch) => batch.batchNo === "LOT-15")?.mrp).toBe(200);
    const batchId = services.batches.find((batch) => batch.batchNo === "LOT-15")?.id;
    await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000040", {
      items: [{ productId: product.id, batchId, quantity: 5, unitKind: "base", unitPrice: 12, gstRate: 0 }],
      payments: [{ mode: "cash", amount: 60 }],
    });
    const stripSale = await transactions.createSalesInvoice("b-1", "u-1", "SAL-2026-000041", {
      items: [{ productId: product.id, batchId, quantity: 1, unitKind: "pack", unitPrice: 180, gstRate: 0 }],
      payments: [{ mode: "cash", amount: 180 }],
    });
    await transactions.createPurchaseReturn("b-1", "u-1", "PRT-2026-000003", {
      purchaseInvoiceId: perMajor.id,
      supplierId: "s-1",
      items: [{ productId: product.id, quantity: 2, unitCost: 150, unitKind: "pack", rateBasis: "pack" }],
    });
    await transactions.createSalesReturn("b-1", "u-1", "SRT-2026-000003", {
      salesInvoiceId: stripSale.invoice.id,
      items: [{ productId: product.id, quantity: 3, unitPrice: 12, unitKind: "base" }],
    });
    const remaining = services.ledger
      .filter((entry) => entry.productId === product.id)
      .reduce((sum, entry) => sum + entry.change, 0);
    expect(remaining).toBe(103);
  });

  describe("Document Control", () => {
    async function setControl(patch: Record<string, unknown>) {
      await services.repos.businesses.setSetting("b-1", DOCUMENT_CONTROL_KEY, patch, "u-1");
    }

    function netQty(productId: string) {
      return services.ledger
        .filter((entry) => entry.productId === productId)
        .reduce((sum, entry) => sum + entry.change, 0);
    }

    it("keeps a backdated document date instead of rewriting it to today", async () => {
      const product = await seedProduct();
      const date = shiftIsoDate(-3);
      const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "INV-BACK", {
        invoiceDate: date,
        items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
        payments: [{ mode: "cash", amount: 236 }],
      });
      expect(invoice.invoiceDate).toBe(date);
      expect(invoice.createdAt.slice(0, 10)).toBe(todayIsoDate());
    });

    it("rejects a backdate beyond the configured window", async () => {
      await setControl({ allowBackdate: true, maxBackdateDays: 5 });
      const product = await seedProduct();
      await expect(
        transactions.createSalesInvoice("b-1", "u-1", "INV-OLD", {
          invoiceDate: shiftIsoDate(-10),
          items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
          payments: [{ mode: "cash", amount: 236 }],
        })
      ).rejects.toThrow(/more than 5 day/);
    });

    it("rejects a future date when future dating is off", async () => {
      await setControl({ allowFutureDate: false });
      const product = await seedProduct();
      await expect(
        transactions.createSalesInvoice("b-1", "u-1", "INV-FUT", {
          invoiceDate: shiftIsoDate(2),
          items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
          payments: [{ mode: "cash", amount: 236 }],
        })
      ).rejects.toThrow(/Future document dates/);
    });

    it("allocates unique numbers from Document Control prefixes", async () => {
      await setControl({ numbering: { sales_invoice: { prefix: "SI" }, purchase_invoice: { prefix: "PB" } } });
      const first = await transactions.nextControlledDocumentNo("b-1", "sales_invoice");
      const second = await transactions.nextControlledDocumentNo("b-1", "sales_invoice");
      const bill = await transactions.nextControlledDocumentNo("b-1", "purchase_invoice");
      expect(first).toMatch(/^SI-\d{4}-000001$/);
      expect(second).toMatch(/^SI-\d{4}-000002$/);
      expect(bill).toMatch(/^PB-\d{4}-000001$/);
      expect(first).not.toBe(second);
    });

    it("does not reuse a number after delete", async () => {
      await setControl({ allowDeletePosted: true });
      const product = await seedProduct();
      const no = await transactions.nextControlledDocumentNo("b-1", "sales_invoice");
      const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", no, {
        items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
        payments: [{ mode: "cash", amount: 236 }],
      });
      await transactions.deleteSalesInvoice("b-1", "u-1", invoice.id);
      const next = await transactions.nextControlledDocumentNo("b-1", "sales_invoice");
      expect(next).not.toBe(no);
      expect(services.salesInvoices.find((row) => row.invoiceNo === no)).toBeUndefined();
    });

    it("hard-deletes a draft without touching stock", async () => {
      const product = await seedProduct();
      const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "INV-DRAFT", {
        asDraft: true,
        items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 18 }],
      });
      expect(netQty(product.id)).toBe(0);
      await transactions.deleteSalesInvoice("b-1", "u-1", invoice.id);
      expect(services.salesInvoices.find((row) => row.id === invoice.id)).toBeUndefined();
      expect(netQty(product.id)).toBe(0);
    });

    it("rejects cancelling a draft", async () => {
      const product = await seedProduct();
      const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "INV-DRAFT-C", {
        asDraft: true,
        items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      });
      await expect(transactions.cancelSalesInvoice("b-1", "u-1", invoice.id)).rejects.toThrow(/Delete the draft/);
    });

    it("cancels a posted sale and restores stock via reversal", async () => {
      const product = await seedProduct();
      await transactions.createPurchaseInvoice("b-1", "u-1", "BILL-STK", {
        items: [{ productId: product.id, quantity: 5, unitPrice: 100, gstRate: 0 }],
      });
      const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "INV-CXL", {
        items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 0 }],
        payments: [{ mode: "cash", amount: 400 }],
      });
      expect(netQty(product.id)).toBe(3);
      await transactions.cancelSalesInvoice("b-1", "u-1", invoice.id);
      expect(services.salesInvoices.find((row) => row.id === invoice.id)?.status).toBe("cancelled");
      expect(netQty(product.id)).toBe(5);
      expect(services.ledger).toContainEqual(
        expect.objectContaining({ productId: product.id, change: 2, movementType: "ADJUSTMENT", reason: "reversal" })
      );
    });

    it("edits a posted sale by reversing then reapplying stock and payments", async () => {
      const product = await seedProduct();
      await transactions.createPurchaseInvoice("b-1", "u-1", "BILL-EDIT", {
        items: [{ productId: product.id, quantity: 10, unitPrice: 100, gstRate: 0 }],
      });
      const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "INV-EDIT", {
        items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 0 }],
        payments: [{ mode: "cash", amount: 400 }],
      });
      expect(netQty(product.id)).toBe(8);
      const updated = await transactions.updateSalesInvoice("b-1", "u-1", invoice.id, {
        items: [{ productId: product.id, quantity: 3, unitPrice: 200, gstRate: 0 }],
        payments: [{ mode: "cash", amount: 600 }],
      });
      expect(updated.invoice.invoiceNo).toBe("INV-EDIT");
      expect(updated.invoice.items[0].quantity).toBe(3);
      expect(netQty(product.id)).toBe(7);
      expect(services.payments.filter((p) => p.salesInvoiceId === invoice.id && p.status !== "cancelled")).toHaveLength(1);
      expect(services.payments.find((p) => p.salesInvoiceId === invoice.id && p.status !== "cancelled")?.amount).toBe(600);
    });

    it("blocks deleting a posted document when allowDeletePosted is off", async () => {
      await setControl({ allowDeletePosted: false });
      const product = await seedProduct();
      const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "INV-KEEP", {
        items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
        payments: [{ mode: "cash", amount: 236 }],
      });
      await expect(transactions.deleteSalesInvoice("b-1", "u-1", invoice.id)).rejects.toThrow(/cannot be deleted/);
    });

    it("blocks editing a locked document without an override reason", async () => {
      await setControl({ lockEnabled: true, lockAfterDays: 1, allowOverrideLock: true });
      const product = await seedProduct();
      const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "INV-LOCK", {
        invoiceDate: shiftIsoDate(-8),
        items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
        payments: [{ mode: "cash", amount: 236 }],
      });
      await expect(
        transactions.updateSalesInvoice("b-1", "u-1", invoice.id, {
          invoiceDate: invoice.invoiceDate,
          items: [{ productId: product.id, quantity: 1, unitPrice: 180, gstRate: 18 }],
          payments: [{ mode: "cash", amount: 212.4 }],
        })
      ).rejects.toThrow(/override reason/);
    });

    it("allows a lock override with reason and writes audit metadata", async () => {
      await setControl({ lockEnabled: true, lockAfterDays: 1, allowOverrideLock: true, allowEditPosted: true });
      const product = await seedProduct();
      await transactions.createPurchaseInvoice("b-1", "u-1", "BILL-LOCK", {
        items: [{ productId: product.id, quantity: 5, unitPrice: 100, gstRate: 0 }],
      });
      const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "INV-OVR", {
        invoiceDate: shiftIsoDate(-8),
        items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 0 }],
        payments: [{ mode: "cash", amount: 200 }],
      });
      await transactions.updateSalesInvoice(
        "b-1",
        "u-1",
        invoice.id,
        {
          invoiceDate: invoice.invoiceDate,
          items: [{ productId: product.id, quantity: 1, unitPrice: 180, gstRate: 0 }],
          payments: [{ mode: "cash", amount: 180 }],
        },
        { overrideLock: true, overrideReason: "year-end correction" }
      );
      expect(services.auditLogs.some((log) => log.action === "invoice.updated" && log.metadata.overrideLock === true)).toBe(true);
    });

    it("blocks sales without edit permission", async () => {
      services.memberPermissions.splice(0, services.memberPermissions.length, "sales.view");
      const product = await seedProduct();
      await expect(
        transactions.createSalesInvoice("b-1", "u-1", "INV-PERM", {
          items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
          payments: [{ mode: "cash", amount: 236 }],
        })
      ).rejects.toThrow(/permission/);
    });

    it("blocks deleting a sale that already has a return", async () => {
      await setControl({ allowDeletePosted: true });
      const product = await seedProduct();
      await transactions.createPurchaseInvoice("b-1", "u-1", "BILL-RET", {
        items: [{ productId: product.id, quantity: 5, unitPrice: 100, gstRate: 0 }],
      });
      const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "INV-RET", {
        items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 0 }],
        payments: [{ mode: "cash", amount: 400 }],
      });
      await transactions.createSalesReturn("b-1", "u-1", "SRT-RET", {
        salesInvoiceId: invoice.id,
        items: [{ productId: product.id, quantity: 1, unitPrice: 200 }],
      });
      await expect(transactions.deleteSalesInvoice("b-1", "u-1", invoice.id)).rejects.toThrow(/sales returns/);
    });

    it("blocks reversing a purchase whose stock was already sold", async () => {
      await setControl({ allowDeletePosted: true });
      const product = await seedProduct();
      const bill = await transactions.createPurchaseInvoice("b-1", "u-1", "BILL-USED", {
        items: [{ productId: product.id, quantity: 2, unitPrice: 100, gstRate: 0 }],
      });
      await transactions.createSalesInvoice("b-1", "u-1", "INV-USED", {
        items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 0 }],
        payments: [{ mode: "cash", amount: 400 }],
      });
      await expect(transactions.deletePurchaseInvoice("b-1", "u-1", bill.id)).rejects.toThrow(/already been used/);
    });

    it("keeps remaining a draft on update only when the existing document is a draft", async () => {
      const product = await seedProduct();
      const { invoice } = await transactions.createSalesInvoice("b-1", "u-1", "INV-STAY", {
        asDraft: true,
        items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
      });
      const stillDraft = await transactions.updateSalesInvoice("b-1", "u-1", invoice.id, {
        asDraft: true,
        items: [{ productId: product.id, quantity: 2, unitPrice: 200, gstRate: 18 }],
      });
      expect(stillDraft.invoice.status).toBe("draft");
      expect(netQty(product.id)).toBe(0);
      const completed = await transactions.updateSalesInvoice("b-1", "u-1", invoice.id, {
        asDraft: false,
        items: [{ productId: product.id, quantity: 1, unitPrice: 200, gstRate: 18 }],
        payments: [{ mode: "cash", amount: 236 }],
      });
      expect(completed.invoice.status).not.toBe("draft");
      expect(netQty(product.id)).toBe(-1);
    });
  });

  describe("GST snapshots", () => {
    function seedSupplier(overrides: Partial<Supplier> = {}): Supplier {
      const now = new Date().toISOString();
      const supplier: Supplier = {
        id: overrides.id ?? `s-${services.suppliers.length + 1}`,
        businessId: "b-1",
        name: overrides.name ?? "Supplier",
        phone: null,
        email: null,
        gstin: overrides.gstin ?? "27AAAAA0000A1Z5",
        pan: null,
        address: null,
        city: null,
        state: overrides.state ?? "Maharashtra",
        pincode: null,
        country: "India",
        gstRegistrationType: overrides.gstRegistrationType ?? "registered",
        placeOfSupplyState: overrides.placeOfSupplyState ?? overrides.state ?? "Maharashtra",
        paymentTerms: null,
        notes: null,
        openingBalance: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        ...overrides,
      };
      services.suppliers.push(supplier);
      return supplier;
    }

    it("does not apply reverse charge just because the tax setting is on", async () => {
      const product = await seedProduct();
      const supplier = seedSupplier({ gstRegistrationType: "registered" });
      await services.repos.businesses.setSetting("b-1", "tax.defaults", {
        gstEnabled: true,
        defaultGstRate: 18,
        defaultIntraState: true,
        reverseChargeEnabled: true,
      }, "u-1");
      const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-GST-RCM-OFF", {
        supplierId: supplier.id,
        items: [{ productId: product.id, quantity: 1, unitPrice: 100, gstRate: 18 }],
      });
      expect(invoice.reverseCharge).toBe(false);
      expect(invoice.itcEligible).toBe(true);
      expect(invoice.taxTotal).toBe(18);
    });

    it("records reverse charge only when the bill is flagged", async () => {
      const product = await seedProduct();
      const supplier = seedSupplier({ gstRegistrationType: "registered" });
      const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-GST-RCM-ON", {
        supplierId: supplier.id,
        reverseCharge: true,
        items: [{ productId: product.id, quantity: 1, unitPrice: 100, gstRate: 18 }],
      });
      expect(invoice.reverseCharge).toBe(true);
      expect(invoice.itcEligible).toBe(true);
      expect(invoice.taxTotal).toBe(18);
    });

    it("records reverse charge when a product is flagged", async () => {
      const product = await services.repos.products.createProduct("b-1", "u-1", {
        name: "RCM item",
        gstRate: 18,
        purchasePrice: 100,
        salePrice: 200,
        reverseCharge: true,
      });
      const supplier = seedSupplier({ gstRegistrationType: "registered" });
      const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-GST-RCM-PROD", {
        supplierId: supplier.id,
        items: [{ productId: product.id, quantity: 1, unitPrice: 100, gstRate: 18 }],
      });
      expect(invoice.reverseCharge).toBe(true);
      expect(invoice.itcEligible).toBe(true);
    });

    it("does not charge tax on a composition supplier bill", async () => {
      const product = await seedProduct();
      const supplier = seedSupplier({ gstRegistrationType: "composition" });
      const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-GST-COMP", {
        supplierId: supplier.id,
        items: [{ productId: product.id, quantity: 1, unitPrice: 100, gstRate: 18 }],
      });
      expect(invoice.gstDocumentType).toBe("bill_of_supply");
      expect(invoice.taxTotal).toBe(0);
      expect(invoice.total).toBe(100);
      expect(invoice.itcEligible).toBe(false);
      expect(invoice.items[0].gstRate).toBe(0);
    });

    it("does not default ITC on a bill with no tax", async () => {
      const product = await seedProduct();
      const supplier = seedSupplier({ gstRegistrationType: "unregistered" });
      const invoice = await transactions.createPurchaseInvoice("b-1", "u-1", "PUR-GST-ITC", {
        supplierId: supplier.id,
        items: [{ productId: product.id, quantity: 1, unitPrice: 100, gstRate: 18 }],
      });
      expect(invoice.itcEligible).toBe(false);
      expect(invoice.taxTotal).toBe(0);
    });

    it("snapshots taxable value after discounts on a sale", async () => {
      const product = await seedProduct();
      const { invoice, totals } = await transactions.createSalesInvoice("b-1", "u-1", "SAL-GST-SNAP", {
        items: [{ productId: product.id, quantity: 1, unitPrice: 500, gstRate: 18, discount: 20 }],
        discount: 30,
        payments: [{ mode: "cash", amount: 531 }],
      });
      expect(invoice.gstDocumentType).toBe("tax_invoice");
      expect(invoice.items[0].taxableAmount).toBe(450);
      expect(totals.taxableAmount).toBe(450);
    });
  });
});

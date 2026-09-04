import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useBusinessSettings } from "../../lib/business/businessSettings.jsx";
import { printElement, printThermalReceipt } from "../../lib/print/print.js";
import { getIrdReprintLabel, isIrdLocked } from "../../lib/compliance/ird.js";
import {
  getJewelleryBreakdown,
  JEWELLERY_ATTRIBUTE_KEYS,
} from "../../lib/business/jewellery.js";
import {
  getServiceAttachmentUrls,
  getServiceItems,
  getServiceOrderTotals,
  normalizeServiceOrder,
} from "../services/serviceOrderUtils.js";
import ServiceInvoiceModal from "../services/ServiceInvoiceModal.jsx";
import { ServiceAttachmentLightbox } from "../services/ServiceOrderAttachments.jsx";

export default function PartyServiceBillModal({ record, onClose, onRefreshed }) {
  const { t } = useI18n();
  const { settings: bizSettings, businessProfile } = useBusinessSettings();

  const [invoiceOrder, setInvoiceOrder] = useState(() =>
    normalizeServiceOrder(record),
  );
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [isThermalInvoice, setIsThermalInvoice] = useState(false);
  const [attributeDefs, setAttributeDefs] = useState([]);
  const [lightboxState, setLightboxState] = useState(null);

  const invoicePrintRef = useRef(null);
  const thermalInvoicePrintRef = useRef(null);

  const businessType = String(businessProfile?.type || "").toLowerCase();
  const isGym = businessType === "gym";
  const showGoldJewelleryDetails = businessType === "gold";
  const safeAttributeDefs = Array.isArray(attributeDefs) ? attributeDefs : [];

  useEffect(() => {
    let active = true;
    api
      .listOrderAttributes({ entityType: "service" })
      .then((response) => {
        const items = Array.isArray(response)
          ? response
          : Array.isArray(response?.items)
            ? response.items
            : [];
        if (active) setAttributeDefs(items);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  const invoiceAttachmentUrls = getServiceAttachmentUrls(invoiceOrder);
  const invoiceItems = getServiceItems(invoiceOrder);
  const invoiceJewellery = getJewelleryBreakdown(
    invoiceOrder?.attributes || {},
  );
  const invoiceExtraAttributes = invoiceOrder?.attributes
    ? Object.entries(invoiceOrder.attributes).filter(
        ([key]) => !JEWELLERY_ATTRIBUTE_KEYS.includes(key),
      )
    : [];
  const invoiceTotals = invoiceOrder
    ? getServiceOrderTotals(invoiceOrder)
    : { laborTotal: 0, partsTotal: 0, subTotal: 0, taxTotal: 0, grandTotal: 0 };
  const invoiceReprintLabel = getIrdReprintLabel(invoiceOrder);

  const money = (value) =>
    t("currency.formatted", {
      symbol: t("currency.symbol"),
      amount: Number(value || 0).toFixed(2),
    }).replace(" ", "\u00a0");

  useEffect(() => {
    let active = true;
    setInvoiceLoading(true);
    api
      .getService(record.id)
      .then((full) => {
        if (active) setInvoiceOrder(normalizeServiceOrder(full));
      })
      .catch(() => null)
      .finally(() => {
        if (active) setInvoiceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [record.id]);

  const openLightbox = (urls = [], index = 0) => {
    const normalized = Array.isArray(urls) ? urls : [urls];
    const abs = normalized.map((u) =>
      u && String(u).startsWith("http") ? u : String(u || ""),
    );
    setLightboxState({
      urls: abs,
      index: Math.max(0, Math.min(index || 0, abs.length - 1)),
    });
  };

  const trackReprint = async () => {
    if (!invoiceOrder?.id || !isIrdLocked(invoiceOrder)) return;
    try {
      const updated = normalizeServiceOrder(
        await api.recordServiceReprint(invoiceOrder.id),
      );
      setInvoiceOrder(updated);
      onRefreshed?.(updated);
    } catch {
      // printing happened; tracking failure shouldn't block the user
    }
  };

  const handlePrint = async () => {
    printElement(invoicePrintRef.current);
    await trackReprint();
  };

  const handlePrintThermal = async () => {
    printThermalReceipt(thermalInvoicePrintRef.current);
    await trackReprint();
  };

  return (
    <>
      <ServiceInvoiceModal
        bizSettings={bizSettings}
        handlePrint={handlePrint}
        handlePrintThermal={handlePrintThermal}
        invoiceAttachmentUrls={invoiceAttachmentUrls}
        invoiceExtraAttributes={invoiceExtraAttributes}
        invoiceItems={invoiceItems}
        invoiceJewellery={invoiceJewellery}
        invoiceLoading={invoiceLoading}
        invoiceOrder={invoiceOrder}
        invoicePrintRef={invoicePrintRef}
        invoiceReprintLabel={invoiceReprintLabel}
        invoiceTotals={invoiceTotals}
        isGym={isGym}
        isThermalInvoice={isThermalInvoice}
        money={money}
        openLightbox={openLightbox}
        safeAttributeDefs={safeAttributeDefs}
        setInvoiceOrder={(next) => {
          setInvoiceOrder(next);
          if (next) onRefreshed?.(next);
        }}
        setIsThermalInvoice={setIsThermalInvoice}
        showGoldJewelleryDetails={showGoldJewelleryDetails}
        t={t}
        thermalInvoicePrintRef={thermalInvoicePrintRef}
      />
      <ServiceAttachmentLightbox
        lightboxState={lightboxState}
        onClose={() => setLightboxState(null)}
        onPrev={() =>
          setLightboxState((s) =>
            s ? { ...s, index: (s.index - 1 + s.urls.length) % s.urls.length } : s,
          )
        }
        onNext={() =>
          setLightboxState((s) =>
            s ? { ...s, index: (s.index + 1) % s.urls.length } : s,
          )
        }
      />
    </>
  );
}

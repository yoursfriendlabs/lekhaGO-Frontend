import { createPortal } from "react-dom";
import Notice from "@/components/ui/Notice";
import PaymentMethodFields from "@/components/form/PaymentMethodFields.jsx";
import NoteTextarea from "@/components/form/NoteTextarea.jsx";
import FormSectionCard from "@/components/ui/FormSectionCard.jsx";
import PaymentTypeSummary from "@/components/form/PaymentTypeSummary.jsx";
import QuickPaymentButtons from "@/components/form/QuickPaymentButtons.jsx";
import AsyncSearchableSelect from "@/components/form/AsyncSearchableSelect.jsx";
import MobileFormStepper from "@/components/form/MobileFormStepper.jsx";
import FlexibleDateInput from "@/components/form/FlexibleDateInput.jsx";
import FileUpload from "@/components/form/FileUpload";
import DynamicAttributes from "@/components/orders/DynamicAttributes";
import {
  JEWELLERY_ATTRIBUTE_KEYS,
  METAL_TYPE_OPTIONS,
} from "@/lib/business/jewellery.js";
import { toProductLookupOption } from "@/lib/lookups.js";
import dayjs from "@/lib/dates/datetime";
import { normalizeAttachmentUrls } from "./serviceOrderUtils.js";
import {
  X,
  Plus,
  Check,
  Search,
  Pencil,
  Phone,
  ArrowRight,
  Package,
  Wrench,
  MessageCircle,
} from "lucide-react";

export default function ServiceOrderFormDialog({
  amountReceived,
  applyQuickReceivedAmount,
  businessProfile,
  canGoBackStep,
  canGoForwardStep,
  canSaveDraftItem,
  cancelItemForm,
  clearParty,
  closeDialog,
  confirmItem,
  createAndSelectParty,
  creatingParty,
  descriptionInputRef,
  dialogOpen,
  dialogTitle,
  discount,
  editLoading,
  editingId,
  editingItemIdx,
  filteredParties,
  formNotice,
  formScrollRef,
  formSteps,
  getProductById,
  getUnitLabel,
  goToNextMobileStep,
  goToPreviousMobileStep,
  handleDraftChange,
  handleDraftProductSelection,
  handleHeaderChange,
  handlePartySearch,
  handleSubmit,
  hasDeliveryDate,
  header,
  irdModeEnabled,
  isGym,
  isPaid,
  itemDraft,
  itemDraftProduct,
  itemDraftVatAmount,
  jewelleryAttributes,
  jewelleryPurityOptions,
  loadProductOptions,
  mobilePrimaryActionLabel,
  mobileStep,
  mobileStepIndex,
  money,
  newPartyPhone,
  partyDropdownOpen,
  partyDropdownRef,
  partyDropdownStyle,
  partyPickerRef,
  partyQuery,
  quantityInputRef,
  removeItem,
  renderStoreTypeDropdown,
  selectParty,
  selectedParty,
  selectedPartyBalanceMeta,
  selectedPartyHasBalance,
  selectedPartyHasDue,
  selectedPartyWhatsAppLink,
  setAmountReceived,
  setDiscount,
  setHasDeliveryDate,
  setHeader,
  setIsPaid,
  setMobileStep,
  setNewPartyPhone,
  setPartyDropdownOpen,
  setShowAddNew,
  showAddNew,
  showDetailsStep,
  showGoldJewelleryDetails,
  showItemForm,
  showItemsStep,
  showPaymentStep,
  startAddItem,
  startEditItem,
  suggestedOrderNo,
  summaryOrderNo,
  t,
  totals,
  updateJewelleryAttribute,
  vacantTables,
  visibleItems
}) {
  if (!dialogOpen) return null;

  return (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div className="flex h-full items-end justify-center md:items-center md:p-5 xl:p-6">
            <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-mist shadow-2xl dark:bg-slate-950 md:h-[calc(100dvh-2.5rem)] md:max-h-[calc(100dvh-2.5rem)] md:max-w-[1440px] md:rounded-[32px] md:border md:border-secondary-200/70 md:dark:border-slate-800/70">
              <div className="flex items-center gap-3 border-b border-secondary-200/70 bg-white/85 px-4 py-3 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80 md:px-8">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary-700 dark:text-primary-200">
                    {t("services.workspaceLabel")}
                  </p>
                  <h2 className="mt-1 truncate font-serif text-xl text-ink md:text-2xl">
                    {dialogTitle}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-2xl p-2 text-secondary-400 transition hover:bg-secondary-100 hover:text-ink-light dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="md:hidden">
                <MobileFormStepper
                  steps={formSteps}
                  currentStep={mobileStep}
                  onStepChange={setMobileStep}
                  onNext={goToNextMobileStep}
                  onBack={goToPreviousMobileStep}
                  canProceed={!editLoading}
                  backLabel={t("common.back")}
                  nextLabel={
                    mobileStep === "items"
                      ? t("services.paymentStep")
                      : t("common.continue")
                  }
                  showNavigation={false}
                />
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div
                  ref={formScrollRef}
                  className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6"
                >
                  <div className="mx-auto w-full max-w-[1320px] space-y-4">
                    {formNotice.message ? (
                      <Notice
                        title={formNotice.message}
                        tone={formNotice.type}
                      />
                    ) : null}

                    {editLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                      </div>
                    ) : null}

                    {showDetailsStep ? (
                      <>
                        <FormSectionCard className="rounded-[28px] border-secondary-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40">
                          <div className="flex items-center justify-between">
                            <label className="label">
                              {t("services.customer")}
                            </label>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-400">
                              {t("common.optional")}
                            </span>
                          </div>
                          <div ref={partyPickerRef} className="relative mt-2">
                            {selectedParty ? (
                              <div className="flex items-center gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-900/10">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-sm font-bold text-white">
                                  {selectedParty.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-semibold text-ink">
                                    {selectedParty.name}
                                  </p>
                                  {selectedParty.phone ? (
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                      <p className="text-xs text-secondary-500">
                                        {selectedParty.phone}
                                      </p>
                                      {!selectedPartyHasDue &&
                                      selectedPartyWhatsAppLink ? (
                                        <a
                                          href={selectedPartyWhatsAppLink}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-semibold text-secondary-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-secondary-200 dark:bg-slate-900 dark:text-secondary-300 dark:ring-slate-700"
                                          aria-label={`Open WhatsApp chat for ${selectedParty.phone}`}
                                        >
                                          <MessageCircle size={12} />
                                          WhatsApp
                                        </a>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  {selectedPartyHasBalance ? (
                                    <div className="mt-0.5">
                                      <p
                                        className={`text-xs ${selectedPartyBalanceMeta.textClass}`}
                                      >
                                        {selectedPartyBalanceMeta.label}:{" "}
                                        {t("currency.formatted", {
                                          symbol: t("currency.symbol"),
                                          amount:
                                            selectedPartyBalanceMeta.absoluteAmount.toFixed(
                                              2,
                                            ),
                                        })}
                                      </p>
                                      {selectedPartyHasDue &&
                                      selectedPartyWhatsAppLink ? (
                                        <a
                                          href={selectedPartyWhatsAppLink}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-800"
                                          aria-label={`Open WhatsApp chat for ${selectedParty.phone}`}
                                        >
                                          <MessageCircle size={12} />
                                          WhatsApp
                                        </a>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                                {renderStoreTypeDropdown()}
                                <button
                                  type="button"
                                  onClick={clearParty}
                                  className="rounded-xl p-2 text-secondary-400 transition hover:bg-white hover:text-ink-light dark:hover:bg-slate-800"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2">
                                  {/* existing search input */}
                                  <div className="flex items-center gap-2 rounded-[24px] border border-secondary-200/70 bg-white px-3 py-3 shadow-sm shadow-slate-200/10 dark:border-slate-700/60 dark:bg-slate-900/60 focus-within:border-primary-300 flex-1">
                                    <Search
                                      size={16}
                                      className="shrink-0 text-secondary-400"
                                    />
                                    <input
                                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-secondary-400 dark:text-slate-200"
                                      placeholder={t("services.customerSearch")}
                                      value={partyQuery}
                                      onChange={handlePartySearch}
                                      onFocus={() => setPartyDropdownOpen(true)}
                                    />
                                    {partyQuery ? (
                                      <button
                                        type="button"
                                        onClick={clearParty}
                                        className="text-secondary-400 transition hover:text-secondary-700"
                                      >
                                        <X size={14} />
                                      </button>
                                    ) : null}
                                  </div>

                                  {renderStoreTypeDropdown()}
                                </div>

                                {partyDropdownOpen &&
                                partyQuery.trim() &&
                                partyDropdownStyle
                                  ? createPortal(
                                      <div
                                        ref={partyDropdownRef}
                                        className="fixed z-[1000] overflow-y-auto rounded-[24px] border border-secondary-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                                        style={partyDropdownStyle}
                                      >
                                        {filteredParties.length > 0
                                          ? filteredParties.map((party) => (
                                              <button
                                                key={party.id}
                                                type="button"
                                                className="flex w-full items-center gap-3 border-b border-secondary-100/80 px-4 py-3 text-left text-sm transition hover:bg-mist dark:border-slate-800/50 dark:hover:bg-slate-800/60 last:border-b-0"
                                                onClick={() =>
                                                  selectParty(party)
                                                }
                                              >
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary-100 text-xs font-bold text-secondary-700 dark:bg-slate-800 dark:text-secondary-300">
                                                  {party.name
                                                    .slice(0, 2)
                                                    .toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <p className="truncate font-semibold text-ink dark:text-slate-200">
                                                    {party.name}
                                                  </p>
                                                  {party.phone ? (
                                                    <p className="truncate text-xs text-secondary-500">
                                                      {party.phone}
                                                    </p>
                                                  ) : null}
                                                </div>
                                              </button>
                                            ))
                                          : null}

                                        {!showAddNew ? (
                                          <button
                                            type="button"
                                            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-primary-700 transition hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/20"
                                            onClick={() => setShowAddNew(true)}
                                          >
                                            <Plus size={14} />
                                            Add &ldquo;{partyQuery.trim()}
                                            &rdquo; as customer
                                          </button>
                                        ) : (
                                          <div className="border-t border-secondary-100 bg-mist p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                            <p className="mb-2 text-xs font-semibold text-secondary-700">
                                              New:{" "}
                                              <span className="text-primary-700">
                                                {partyQuery.trim()}
                                              </span>
                                            </p>
                                            <div className="flex items-center gap-2 rounded-xl border border-secondary-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                              <Phone
                                                size={13}
                                                className="shrink-0 text-secondary-400"
                                              />
                                              <input
                                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-secondary-400"
                                                type="tel"
                                                inputMode="numeric"
                                                placeholder={t(
                                                  "parties.phonePlaceholder",
                                                )}
                                                value={newPartyPhone}
                                                disabled={creatingParty}
                                                onChange={(e) =>
                                                  setNewPartyPhone(
                                                    e.target.value,
                                                  )
                                                }
                                              />
                                            </div>
                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                              <button
                                                type="button"
                                                className="btn-ghost text-xs"
                                                onClick={() =>
                                                  setShowAddNew(false)
                                                }
                                                disabled={creatingParty}
                                              >
                                                {t("common.cancel")}
                                              </button>
                                              <button
                                                type="button"
                                                className="btn-primary text-xs"
                                                onClick={createAndSelectParty}
                                                disabled={creatingParty}
                                              >
                                                {creatingParty
                                                  ? t("common.loading")
                                                  : t("services.addSelect")}
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>,
                                      document.body,
                                    )
                                  : null}
                              </div>
                            )}
                          </div>

                          <div className={`mt-4 grid gap-3 sm:grid-cols-3 ${businessProfile?.settings?.enabledModules?.includes('tables') ? 'lg:grid-cols-4' : ''}`}>
                            <div>
                              <label className="label">
                                {t("services.orderNo")}
                              </label>
                              <input
                                className="input mt-1"
                                name="orderNo"
                                value={header.orderNo}
                                onChange={handleHeaderChange}
                                disabled={irdModeEnabled}
                                placeholder={!editingId ? suggestedOrderNo : ""}
                              />
                            </div>
                            <div>
                              <label className="label">
                                {t("services.status")}
                              </label>
                              <select
                                className="input mt-1"
                                name="status"
                                value={header.status}
                                onChange={handleHeaderChange}
                              >
                                <option value="in_progress">
                                  {t("services.inProgress")}
                                </option>
                                <option value="closed">
                                  {t("services.closed")}
                                </option>
                              </select>
                            </div>

                            <div>
                              <label className="label">
                                {isGym ? "Subscription End" : t("services.deliveryDate") || "Delivery Date"}
                              </label>
                              <div className="flex h-11 items-center justify-between rounded-xl border border-secondary-200 bg-secondary-50/20 px-3.5 mt-1 dark:border-slate-800 dark:bg-slate-900/50">
                                <span className="text-xs font-bold text-secondary-500 dark:text-secondary-400">
                                  {hasDeliveryDate ? t("common.yes") : t("common.no")}
                                </span>
                                <label className="relative inline-flex cursor-pointer items-center text-xs">
                                  <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={hasDeliveryDate}
                                    onChange={(e) => setHasDeliveryDate(e.target.checked)}
                                  />
                                  <div className="peer h-6 w-11 rounded-full bg-secondary-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-secondary-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:bg-slate-700"></div>
                                </label>
                              </div>
                            </div>

                            {hasDeliveryDate && (
                              <div>
                                <label className="label">
                                  {isGym ? "Subscription End Date" : t("services.deliveryDate")}
                                </label>
                                <FlexibleDateInput
                                  className="input mt-1"
                                  name="deliveryDate"
                                  value={header.deliveryDate}
                                  onChange={handleHeaderChange}
                                />
                                {isGym && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {[
                                      { label: "+1 Month", days: 30 },
                                      { label: "+3 Months", days: 90 },
                                      { label: "+6 Months", days: 180 },
                                      { label: "+1 Year", days: 365 },
                                    ].map((opt) => (
                                      <button
                                        key={opt.label}
                                        type="button"
                                        onClick={() => {
                                          const nextDate = dayjs().add(opt.days, "day").format("YYYY-MM-DD");
                                          setHeader((prev) => ({ ...prev, deliveryDate: nextDate }));
                                        }}
                                        className="px-2.5 py-1.5 rounded-xl border border-secondary-200 hover:border-primary text-xs font-bold text-secondary-700 bg-white hover:bg-primary/5 transition shadow-sm"
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {businessProfile?.settings?.enabledModules?.includes('tables') && (
                              <div>
                                <label className="label">{t('tables.tableName') || 'Table'}</label>
                                <select
                                  name="tableId"
                                  className="input mt-1"
                                  value={header.tableId || ''}
                                  onChange={handleHeaderChange}
                                >
                                  <option value="">No Table / Takeaway</option>
                                  {vacantTables.map((table) => (
                                    <option key={table.id} value={table.id}>
                                      {table.name} {table.capacity ? `(Cap: ${table.capacity})` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </FormSectionCard>

                        <FormSectionCard
                          title={t("services.notesSectionTitle")}
                          hint={t("services.notesSectionHint")}
                          className="rounded-[28px] border-secondary-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
                        >
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                            <div>
                              <label className="label">
                                {t("services.notes")}
                              </label>
                              <NoteTextarea
                                className="input mt-1 h-32 resize-none"
                                name="notes"
                                value={header.notes}
                                onChange={handleHeaderChange}
                                placeholder={t("services.notesPlaceholder")}
                              />
                            </div>
                            <div className="rounded-[24px] border border-secondary-200/70 bg-mist/70 p-4 dark:border-slate-800/70 dark:bg-slate-900/40">
                              <FileUpload
                                label={t("services.attachment")}
                                multiple
                                initialUrls={header.attachments}
                                onUpload={(urls) =>
                                  setHeader((prev) => ({
                                    ...prev,
                                    attachments: Array.isArray(urls)
                                      ? urls
                                      : normalizeAttachmentUrls(urls),
                                    attachment: Array.isArray(urls)
                                      ? urls[0] || ""
                                      : String(urls || ""),
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </FormSectionCard>

                        {/* <FormSectionCard
                          title="Jewellery details"
                          hint="Track metal purity, wastage, total weight, and simple diamond charges for jewellery orders."
                          className="rounded-[28px] border-secondary-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
                        >
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div>
                              <label className="label">Metal type</label>
                              <select
                                className="input mt-1"
                                value={jewelleryAttributes.metalType}
                                onChange={(event) => updateJewelleryAttribute('metalType', event.target.value)}
                              >
                                <option value="">Select metal</option>
                                {METAL_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">Purity</label>
                              {jewelleryPurityOptions.length > 0 ? (
                                <select
                                  className="input mt-1"
                                  value={jewelleryAttributes.metalPurity}
                                  onChange={(event) => updateJewelleryAttribute('metalPurity', event.target.value)}
                                >
                                  <option value="">Select purity</option>
                                  {jewelleryPurityOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  className="input mt-1"
                                  value={jewelleryAttributes.metalPurity}
                                  onChange={(event) => updateJewelleryAttribute('metalPurity', event.target.value)}
                                  placeholder="e.g. 22K or 925"
                                />
                              )}
                            </div>
                            <div>
                              <label className="label">Actual weight</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.001"
                                value={jewelleryAttributes.actualWeight}
                                onChange={(event) => updateJewelleryAttribute('actualWeight', event.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="label">Wastage %</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="5"
                                max="15"
                                step="0.01"
                                value={jewelleryAttributes.wastagePercent}
                                onChange={(event) => updateJewelleryAttribute('wastagePercent', event.target.value)}
                                placeholder="5 - 15"
                              />
                            </div>
                            <div>
                              <label className="label">Wastage weight</label>
                              <input
                                className="input mt-1 bg-mist"
                                value={jewelleryAttributes.wastageWeight}
                                placeholder="Auto calculated"
                                readOnly
                              />
                            </div>
                            <div>
                              <label className="label">Total weight</label>
                              <input
                                className="input mt-1 bg-mist"
                                value={jewelleryAttributes.totalWeight}
                                placeholder="Actual + wastage"
                                readOnly
                              />
                            </div>
                            <div>
                              <label className="label">Diamond type</label>
                              <input
                                className="input mt-1"
                                value={jewelleryAttributes.diamondType}
                                onChange={(event) => updateJewelleryAttribute('diamondType', event.target.value)}
                                placeholder="e.g. VVS, round"
                              />
                            </div>
                            <div>
                              <label className="label">Diamond weight</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.001"
                                value={jewelleryAttributes.diamondWeight}
                                onChange={(event) => updateJewelleryAttribute('diamondWeight', event.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="label">Diamond carat</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.01"
                                value={jewelleryAttributes.diamondCarat}
                                onChange={(event) => updateJewelleryAttribute('diamondCarat', event.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="label">Diamond purity / grade</label>
                              <input
                                className="input mt-1"
                                value={jewelleryAttributes.diamondPurity}
                                onChange={(event) => updateJewelleryAttribute('diamondPurity', event.target.value)}
                                placeholder="Optional"
                              />
                            </div>
                            <div>
                              <label className="label">Diamond charge</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.01"
                                value={jewelleryAttributes.diamondCharge}
                                onChange={(event) => updateJewelleryAttribute('diamondCharge', event.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="label">Additional tax</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.01"
                                value={jewelleryAttributes.additionalTax}
                                onChange={(event) => updateJewelleryAttribute('additionalTax', event.target.value)}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </FormSectionCard> */}

                        <FormSectionCard
                          title={t("services.orderInformation")}
                          className="rounded-[28px] border-secondary-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
                        >
                          <DynamicAttributes
                            entityType="service"
                            attributes={header.attributes}
                            hiddenKeys={JEWELLERY_ATTRIBUTE_KEYS}
                            onChange={(attr) =>
                              setHeader((prev) => ({
                                ...prev,
                                attributes: attr,
                              }))
                            }
                          />
                        </FormSectionCard>
                      </>
                    ) : null}

                    {showItemsStep ? (
                      <FormSectionCard
                        title={t("services.items")}
                        hint={t("services.itemsSectionHint")}
                        action={
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <span className="text-sm font-semibold text-secondary-500">
                              {visibleItems.length} {t("services.items")}
                            </span>
                            <button
                              className="btn-ghost w-full sm:w-auto"
                              type="button"
                              onClick={startAddItem}
                            >
                              {t("services.addLine")}
                            </button>
                          </div>
                        }
                        className="rounded-[28px] border-secondary-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
                      >
                        {visibleItems.length > 0 ? (
                          <div className="mb-4 space-y-3">
                            {visibleItems.map((item, idx) => {
                              const product = getProductById(item.productId);
                              const displayName =
                                item.itemType === "part"
                                  ? product?.name ||
                                    item.description ||
                                    t("services.productLine")
                                  : item.description ||
                                    t("services.serviceLine");
                              const unitLabel =
                                item.itemType === "part"
                                  ? getUnitLabel(product, item.unitType)
                                  : "";

                              return (
                                <div
                                  key={`item-row-${idx}`}
                                  className="rounded-[24px] border border-secondary-200/70 bg-mist/60 p-3.5 dark:border-slate-800/60 dark:bg-slate-900/40"
                                >
                                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start gap-3">
                                        <div
                                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.itemType === "labor" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}
                                        >
                                          {item.itemType === "labor" ? (
                                            <Wrench size={18} />
                                          ) : (
                                            <Package size={18} />
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span
                                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.itemType === "labor" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}
                                            >
                                              {item.itemType === "labor"
                                                ? t("services.serviceLine")
                                                : t("services.productLine")}
                                            </span>
                                            <p className="truncate font-semibold text-ink">
                                              {displayName}
                                            </p>
                                          </div>
                                          {item.itemType === "part" &&
                                          item.description &&
                                          product?.name &&
                                          item.description !== product.name ? (
                                            <p className="mt-1 text-sm text-secondary-500">
                                              {item.description}
                                            </p>
                                          ) : null}
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {item.itemType === "part" && (
                                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-secondary-700 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-secondary-300 dark:ring-slate-700/70">
                                                {t("services.qty")}:{" "}
                                                {item.quantity}
                                                {unitLabel
                                                  ? ` ${unitLabel}`
                                                  : ""}
                                              </span>
                                            )}
                                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-secondary-700 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-secondary-300 dark:ring-slate-700/70">
                                              {item.itemType === "labor"
                                                ? t("common.total")
                                                : t("services.unitPrice")}
                                              : {money(item.unitPrice)}
                                            </span>
                                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-secondary-700 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-secondary-300 dark:ring-slate-700/70">
                                              {t("services.tax")}:{" "}
                                              {Number(
                                                item.taxRate || 0,
                                              ).toFixed(2)}
                                              %
                                            </span>
                                            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-primary-900/70">
                                              {t("common.total")}:{" "}
                                              {money(item.lineTotal)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 xl:pl-4">
                                      <button
                                        type="button"
                                        className="btn-ghost flex-1 text-sm xl:flex-none"
                                        onClick={() => startEditItem(idx)}
                                      >
                                        <Pencil
                                          size={14}
                                          className="mr-1.5 inline"
                                        />
                                        {t("common.edit")}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-ghost flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 xl:flex-none dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/20"
                                        onClick={() => removeItem(idx)}
                                      >
                                        <X
                                          size={14}
                                          className="mr-1.5 inline"
                                        />
                                        {t("common.remove")}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mb-4 rounded-[24px] border border-dashed border-slate-300 bg-mist/70 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
                            <p className="text-sm text-secondary-500">
                              {t("services.addFirstItem")}
                            </p>
                            <button
                              type="button"
                              className="btn-primary mt-4 w-full sm:w-auto"
                              onClick={startAddItem}
                            >
                              <Plus size={15} className="mr-1.5 inline" />
                              {t("services.addLine")}
                            </button>
                          </div>
                        )}
                      </FormSectionCard>
                    ) : null}

                    <Dialog
                      isOpen={showItemForm}
                      onClose={cancelItemForm}
                      title={
                        editingItemIdx !== null
                          ? t("services.editLine")
                          : t("services.addLine")
                      }
                      size="xl"
                      footer={
                        <>
                          <button
                            type="button"
                            className="btn-secondary w-full sm:w-auto"
                            onClick={cancelItemForm}
                          >
                            {t("common.cancel")}
                          </button>
                          <button
                            type="button"
                            className="btn-primary w-full sm:w-auto"
                            onClick={confirmItem}
                            disabled={!canSaveDraftItem}
                          >
                            {editingItemIdx !== null
                              ? t("common.update")
                              : t("common.add")}
                          </button>
                        </>
                      }
                    >
                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-200">
                              {t("services.itemComposerTitle")}
                            </p>
                            <p className="mt-2 text-sm text-secondary-700">
                              {t("services.itemComposerHint")}
                            </p>
                          </div>

                          <div className="flex flex-col gap-4">
                            <div>
                              <label className="label">
                                {t("services.type")}
                              </label>
                              <div className="mt-1 flex gap-2">
                                <button
                                  type="button"
                                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                                    itemDraft.itemType === "labor"
                                      ? "bg-primary-600 text-white shadow-md ring-2 ring-primary-600 ring-offset-2 dark:ring-offset-slate-900"
                                      : "bg-secondary-100 text-secondary-700 hover:bg-secondary-200 dark:bg-slate-800 dark:text-secondary-400 dark:hover:bg-slate-700"
                                  }`}
                                  onClick={() =>
                                    handleDraftChange("itemType", "labor")
                                  }
                                >
                                  {t("services.serviceLine")}
                                </button>
                                <button
                                  type="button"
                                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                                    itemDraft.itemType === "part"
                                      ? "bg-primary-600 text-white shadow-md ring-2 ring-primary-600 ring-offset-2 dark:ring-offset-slate-900"
                                      : "bg-secondary-100 text-secondary-700 hover:bg-secondary-200 dark:bg-slate-800 dark:text-secondary-400 dark:hover:bg-slate-700"
                                  }`}
                                  onClick={() =>
                                    handleDraftChange("itemType", "part")
                                  }
                                >
                                  {t("services.productLine")}
                                </button>
                              </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className="label">
                                  {t("services.description")}
                                </label>
                                <input
                                  ref={descriptionInputRef}
                                  className="input mt-1"
                                  value={itemDraft.description}
                                  onChange={(e) =>
                                    handleDraftChange(
                                      "description",
                                      e.target.value,
                                    )
                                  }
                                  placeholder={t("services.placeholderService")}
                                />
                              </div>

                              {itemDraft.itemType === "part" ? (
                                <div className="sm:col-span-2">
                                  <label className="label">
                                    {t("services.productParts")}
                                  </label>
                                  <AsyncSearchableSelect
                                    className="mt-1"
                                    value={itemDraft.productId}
                                    selectedOption={
                                      itemDraftProduct
                                        ? toProductLookupOption(
                                            itemDraftProduct,
                                          )
                                        : null
                                    }
                                    onChange={handleDraftProductSelection}
                                    loadOptions={loadProductOptions}
                                    placeholder={t("purchases.selectProduct")}
                                    searchPlaceholder={t(
                                      "purchases.selectProduct",
                                    )}
                                    noResultsLabel={t("common.noData")}
                                    loadingLabel={t("common.loading")}
                                    renderOption={(option) => (
                                      <div className="flex items-center gap-2">
                                        {option.entity?.imageUrl ? (
                                          <img src={option.entity.imageUrl} alt={option.label} className="h-6 w-6 rounded object-cover border border-secondary-200 dark:border-slate-800" />
                                        ) : (
                                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-secondary-100 text-[10px] font-bold text-secondary-400 dark:bg-slate-800">
                                            {option.entity?.name?.charAt(0).toUpperCase() || 'P'}
                                          </div>
                                        )}
                                        <span>{option.label}</span>
                                      </div>
                                    )}
                                  />
                                </div>
                              ) : null}

                              {itemDraft.itemType === "part" &&
                              itemDraftProduct?.secondaryUnit ? (
                                <div className="sm:col-span-2">
                                  <label className="label">
                                    {t("products.unitType")}
                                  </label>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDraftChange(
                                          "unitType",
                                          "primary",
                                          itemDraftProduct.primaryUnit,
                                        )
                                      }
                                      className={
                                        itemDraft.unitType === "primary"
                                          ? "btn-primary btn-sm w-full"
                                          : "btn-ghost btn-sm w-full"
                                      }
                                    >
                                      {itemDraftProduct.primaryUnit ||
                                        t("products.primaryUnit")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDraftChange(
                                          "unitType",
                                          "secondary",
                                          itemDraftProduct.secondaryUnit,
                                        )
                                      }
                                      className={
                                        itemDraft.unitType === "secondary"
                                          ? "btn-primary btn-sm w-full"
                                          : "btn-ghost btn-sm w-full"
                                      }
                                    >
                                      {itemDraftProduct.secondaryUnit}
                                    </button>
                                  </div>
                                  {itemDraftProduct.conversionRate > 0 ? (
                                    <p className="mt-2 text-xs text-secondary-500">
                                      1 {itemDraftProduct.primaryUnit} ={" "}
                                      {itemDraftProduct.conversionRate}{" "}
                                      {itemDraftProduct.secondaryUnit}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}

                              {itemDraft.itemType === "part" ? (
                                <div>
                                  <label className="label">
                                    {t("services.qty")}
                                  </label>
                                  <input
                                    ref={quantityInputRef}
                                    className="input mt-1"
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.1"
                                    value={itemDraft.quantity}
                                    onChange={(e) =>
                                      handleDraftChange(
                                        "quantity",
                                        e.target.value,
                                      )
                                    }
                                  />
                                  {itemDraft.itemType === "part" ? (
                                    <p className="mt-1 text-xs text-secondary-500">
                                      {getUnitLabel(
                                        itemDraftProduct,
                                        itemDraft.unitType,
                                      )}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                              <div>
                                <label className="label">
                                  {itemDraft.itemType === "labor"
                                    ? t("common.total")
                                    : t("services.unitPrice")}
                                </label>
                                <input
                                  className="input mt-1"
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={itemDraft.unitPrice}
                                  onChange={(e) =>
                                    handleDraftChange(
                                      "unitPrice",
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="label">
                                  {t("services.tax")}
                                </label>
                                <input
                                  className="input mt-1"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={itemDraft.taxRate}
                                  onChange={(e) =>
                                    handleDraftChange("taxRate", e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[28px] border border-primary-200 bg-primary-50/60 p-4 shadow-sm dark:border-primary-900/40 dark:bg-primary-900/15">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-200">
                            {t("common.total")}
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-ink">
                            {money(itemDraft.lineTotal)}
                          </p>
                          <div className="mt-4 space-y-3">
                            <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                                {t("services.taxTotal")}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-ink dark:text-slate-200">
                                {money(itemDraftVatAmount)}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                                {t("services.type")}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-ink dark:text-slate-200">
                                {itemDraft.itemType === "labor"
                                  ? t("services.serviceLine")
                                  : t("services.productLine")}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                                {t("services.description")}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-ink dark:text-slate-200">
                                {itemDraft.itemType === "part"
                                  ? itemDraftProduct?.name ||
                                    itemDraft.description ||
                                    "—"
                                  : itemDraft.description || "—"}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                                {t("products.unitType")}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-ink dark:text-slate-200">
                                {getUnitLabel(
                                  itemDraftProduct,
                                  itemDraft.unitType,
                                ) || t("products.primaryUnit")}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Dialog>

                    {showPaymentStep ? (
                      <FormSectionCard
                        title={t("services.paymentSectionTitle")}
                        hint={t("services.paymentSectionHint")}
                        className="rounded-[28px] border-secondary-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
                      >
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                          <div className="rounded-[24px] border border-secondary-200/70 bg-mist/70 p-4 dark:border-slate-800/70 dark:bg-slate-900/40">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                              <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                                  {t("services.subTotal")}
                                </p>
                                <p className="mt-1 text-lg font-semibold text-ink">
                                  {money(totals.subTotal)}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                                  Service Total
                                </p>
                                <p className="mt-1 text-lg font-semibold text-ink">
                                  {money(totals.laborTotal)}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                                  Product Total
                                </p>
                                <p className="mt-1 text-lg font-semibold text-ink">
                                  {money(totals.partsTotal)}
                                </p>
                              </div>
                              {showGoldJewelleryDetails ? (
                                <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                                    Diamond Charge
                                  </p>
                                  <p className="mt-1 text-lg font-semibold text-ink">
                                    {money(totals.diamondCharge)}
                                  </p>
                                </div>
                              ) : null}
                              <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                                  {t("services.taxTotal")}
                                </p>
                                <p className="mt-1 text-lg font-semibold text-ink">
                                  {money(totals.taxTotal)}
                                </p>
                              </div>
                              {showGoldJewelleryDetails ? (
                                <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                                    Additional Tax
                                  </p>
                                  <p className="mt-1 text-lg font-semibold text-ink">
                                    {money(totals.additionalTax)}
                                  </p>
                                </div>
                              ) : null}
                              <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                                  {t("services.discount")}
                                </p>
                                <p className="mt-1 text-lg font-semibold text-rose-700 dark:text-rose-300">
                                  -{money(totals.discountTotal)}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white dark:bg-primary-900/70">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                                  {t("services.grandTotal")}
                                </p>
                                <p className="mt-1 text-xl font-semibold">
                                  {money(totals.grandTotal)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="label">
                                {t("services.discount")}
                              </label>
                              <input
                                className="input mt-1"
                                type="number"
                                step="0.01"
                                min="0"
                                max={(
                                  totals.subTotal + totals.taxTotal
                                ).toFixed(2)}
                                value={discount}
                                onChange={(e) => setDiscount(e.target.value)}
                              />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                              <div>
                                <label className="label">
                                  {t("services.amountReceived")}
                                </label>
                                <input
                                  className="input mt-1"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={
                                    isPaid
                                      ? totals.grandTotal.toFixed(2)
                                      : amountReceived
                                  }
                                  disabled={isPaid}
                                  onChange={(e) =>
                                    setAmountReceived(e.target.value)
                                  }
                                />
                                <QuickPaymentButtons
                                  disabled={totals.grandTotal <= 0}
                                  onNoPayment={() =>
                                    applyQuickReceivedAmount(0)
                                  }
                                  onHalfPayment={() =>
                                    applyQuickReceivedAmount(
                                      totals.grandTotal / 2,
                                    )
                                  }
                                  onFullPayment={() =>
                                    applyQuickReceivedAmount(
                                      totals.grandTotal,
                                      { markPaid: true },
                                    )
                                  }
                                />
                              </div>
                              <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-secondary-200/70 bg-mist/70 px-4 py-3 text-sm font-semibold text-ink-light transition hover:bg-secondary-100 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-secondary-300 dark:hover:bg-slate-800/60">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded accent-primary-600"
                                  checked={isPaid}
                                  onChange={(e) => setIsPaid(e.target.checked)}
                                />
                                {t("services.fullyPaid")}
                              </label>
                            </div>

                            {totals.due > 0 ? (
                              <div className="rounded-[24px] border border-rose-200/70 bg-rose-50/70 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-900/20">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500 dark:text-rose-300">
                                  {t("services.dueAmount")}
                                </p>
                                <p className="mt-1 text-lg font-semibold text-rose-700 dark:text-rose-200">
                                  {money(totals.due)}
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-[24px] border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                                  {t("services.fullyPaid")}
                                </p>
                              </div>
                            )}

                            <div className="rounded-[24px] border border-secondary-200/70 bg-mist/70 p-4 dark:border-slate-800/70 dark:bg-slate-900/40">
                              <PaymentMethodFields
                                value={header}
                                onChange={(patch) =>
                                  setHeader((prev) => ({ ...prev, ...patch }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </FormSectionCard>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-secondary-200/70 bg-white/90 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/85 md:px-8">
                  <div className="mx-auto w-full max-w-[1320px]">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-4 rounded-2xl bg-secondary-100/90 px-4 py-2.5 text-sm dark:bg-slate-900/70 lg:min-w-[520px]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-ink dark:text-slate-200">
                            {formSteps[mobileStepIndex]?.label ||
                              t("services.detailStep")}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-secondary-500">
                            Order: {summaryOrderNo}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`font-bold ${totals.due > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}
                          >
                            {money(totals.due)}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-secondary-500">
                            {t("services.summaryDue")}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        {canGoBackStep ? (
                          <button
                            type="button"
                            className="btn-ghost w-full sm:w-auto"
                            onClick={goToPreviousMobileStep}
                            disabled={editLoading}
                          >
                            {t("common.back")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-ghost w-full sm:w-auto"
                            onClick={closeDialog}
                            disabled={editLoading}
                          >
                            {t("common.cancel")}
                          </button>
                        )}

                        {canGoForwardStep ? (
                          <button
                            type="button"
                            className="btn-primary w-full sm:w-auto"
                            onClick={goToNextMobileStep}
                            disabled={editLoading}
                          >
                            {mobilePrimaryActionLabel}
                            <ArrowRight size={14} className="ml-1.5 inline" />
                          </button>
                        ) : (
                          <button
                            type="submit"
                            className="btn-primary w-full sm:w-auto"
                            disabled={editLoading}
                          >
                            {mobilePrimaryActionLabel}
                            <Check size={14} className="ml-1.5 inline" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
  );
}

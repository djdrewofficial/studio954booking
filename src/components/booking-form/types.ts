import type {
  BookingKind,
  BookingType,
  EquipmentProvider,
  RecurrenceFrequency,
  TechnicianProvider,
} from "@/lib/domain";

/** Everything the form holds, kept as plain values so it round-trips cleanly. */
export type BookingFormValues = {
  title: string;
  kind: BookingKind;
  bookingType: BookingType;
  clientName: string;
  /** Empty when the booking is not tied to a client record. */
  clientId: string;
  /** The membership being drawn down; required when kind is "membership". */
  clientMembershipId: string;

  technicianProvider: TechnicianProvider;
  equipmentProvider: EquipmentProvider;

  /** Only sent when priceManual is on; otherwise the server quotes it. */
  priceCents: number;
  priceManual: boolean;

  date: string;
  startTime: string;
  endTime: string;
  setupMinutes: number;
  resetMinutes: number;

  studioSetId: string;
  setOptionIds: string[];

  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;

  notes: string;
  internalNotes: string;
  microphoneCount: number;

  attendees: { name: string; email: string; notify: boolean }[];

  usesTeleprompter: boolean;
  /** Uploaded to storage first, so a script can be attached before saving. */
  teleprompterFiles: {
    fileName: string;
    storagePath: string;
    contentType?: string;
    sizeBytes?: number;
  }[];

  recurrence: RecurrenceFrequency;
  recurrenceUntil: string;
};

export type SetOptionChoice = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  swatchHex: string | null;
  /** Empty means the option is offered on every set. */
  studioSetIds: string[];
};

export type OptionCategoryChoice = {
  id: string;
  name: string;
  slug: string;
  allowsMultiple: boolean;
  isRequired: boolean;
  options: SetOptionChoice[];
};

export type StudioSetChoice = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

/** A client the form can pick, with their live membership if they hold one. */
export type ClientChoice = {
  id: string;
  name: string;
  membership: { id: string; planName: string } | null;
};

export type BookingCatalogue = {
  sets: StudioSetChoice[];
  categories: OptionCategoryChoice[];
  defaults: Record<BookingKind, { setupMinutes: number; resetMinutes: number }>;
  clients: ClientChoice[];
  timezone: string;
};

/** Options a given set actually offers. */
export function categoriesForSet(
  categories: OptionCategoryChoice[],
  studioSetId: string,
): OptionCategoryChoice[] {
  return categories
    .map((category) => ({
      ...category,
      options: category.options.filter(
        (o) => o.studioSetIds.length === 0 || o.studioSetIds.includes(studioSetId),
      ),
    }))
    .filter((category) => category.options.length > 0);
}

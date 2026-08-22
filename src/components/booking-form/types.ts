import type { BookingKind, BookingType, RecurrenceFrequency } from "@/lib/domain";

/** Everything the form holds, kept as plain values so it round-trips cleanly. */
export type BookingFormValues = {
  title: string;
  kind: BookingKind;
  bookingType: BookingType;
  clientName: string;

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

export type BookingCatalogue = {
  sets: StudioSetChoice[];
  categories: OptionCategoryChoice[];
  defaults: {
    internal: { setupMinutes: number; resetMinutes: number };
    external: { setupMinutes: number; resetMinutes: number };
  };
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

-- Studio 954 — development seed.
--
-- Idempotent: every row carries a fixed id and re-running only fills gaps.
-- Sample bookings are anchored to *today in the studio's timezone*, so the
-- Today screen and calendar always have something real in them.
--
-- Deliberately no user accounts here. The first admin is created through the
-- app's first-run screen so no password ever lives in source control.

-- ---------------------------------------------------------------------------
-- Studio
-- ---------------------------------------------------------------------------
INSERT INTO studio_settings (id, studio_name, timezone, address_line1, city, region, postal_code,
                             contact_email, arrival_instructions,
                             external_setup_minutes, external_reset_minutes,
                             internal_setup_minutes, internal_reset_minutes)
VALUES (1, 'Studio 954', 'America/New_York', '954 Creative Way', 'Fort Lauderdale', 'FL', '33301',
        'booking@studio954.com',
        'Park in the rear lot and use the grey door marked 954. Someone will meet you at the door five minutes before your call time.',
        30, 30, 15, 15)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sets
-- ---------------------------------------------------------------------------
INSERT INTO studio_sets (id, name, description, sort_order, is_active) VALUES
  ('11111111-0000-4000-8000-000000000001', 'Podcast Lounge',
   'Two to four seats around a low table. Warm, lived-in, built for long-form conversation.', 1, true),
  ('11111111-0000-4000-8000-000000000002', 'Interview Set',
   'Single subject facing camera against a clean backdrop. Fast to light, easy to reset.', 2, true),
  ('11111111-0000-4000-8000-000000000003', 'Creator Desk',
   'Seated desk setup for talking-head, tutorial and vertical social content.', 3, true),
  ('11111111-0000-4000-8000-000000000004', 'Photo / Open Set',
   'Cleared floor with seamless backdrop for photography and product work.', 4, true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Customisation categories
-- ---------------------------------------------------------------------------
INSERT INTO set_option_categories (id, name, slug, allows_multiple, is_required, sort_order) VALUES
  ('22222222-0000-4000-8000-000000000001', 'Curtain / Background', 'curtain',  false, true,  1),
  ('22222222-0000-4000-8000-000000000002', 'Seating',              'seating',  false, true,  2),
  ('22222222-0000-4000-8000-000000000003', 'Table',                'table',    false, false, 3),
  ('22222222-0000-4000-8000-000000000004', 'Accent Lighting',      'lighting', false, false, 4),
  ('22222222-0000-4000-8000-000000000005', 'Decor',                'decor',    true,  false, 5)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Options
-- ---------------------------------------------------------------------------
INSERT INTO set_options (id, category_id, name, swatch_hex, sort_order) VALUES
  -- Curtain / Background
  ('33333333-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'Black',        '#141416', 1),
  ('33333333-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', 'White',        '#F4F3EF', 2),
  ('33333333-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000001', 'Beige',        '#D8C7A8', 3),
  ('33333333-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000001', 'Green Screen', '#3FBF54', 4),
  -- Seating
  ('33333333-0000-4000-8000-000000000011', '22222222-0000-4000-8000-000000000002', 'Black Lounge Chairs', NULL, 1),
  ('33333333-0000-4000-8000-000000000012', '22222222-0000-4000-8000-000000000002', 'Tan Chairs',          NULL, 2),
  ('33333333-0000-4000-8000-000000000013', '22222222-0000-4000-8000-000000000002', 'Stools',              NULL, 3),
  ('33333333-0000-4000-8000-000000000014', '22222222-0000-4000-8000-000000000002', 'No Chairs',           NULL, 4),
  -- Table
  ('33333333-0000-4000-8000-000000000021', '22222222-0000-4000-8000-000000000003', 'Coffee Table',  NULL, 1),
  ('33333333-0000-4000-8000-000000000022', '22222222-0000-4000-8000-000000000003', 'Podcast Table', NULL, 2),
  ('33333333-0000-4000-8000-000000000023', '22222222-0000-4000-8000-000000000003', 'Desk',          NULL, 3),
  ('33333333-0000-4000-8000-000000000024', '22222222-0000-4000-8000-000000000003', 'None',          NULL, 4),
  -- Accent Lighting
  ('33333333-0000-4000-8000-000000000031', '22222222-0000-4000-8000-000000000004', 'Warm',   '#F0A868', 1),
  ('33333333-0000-4000-8000-000000000032', '22222222-0000-4000-8000-000000000004', 'Blue',   '#3F7FD9', 2),
  ('33333333-0000-4000-8000-000000000033', '22222222-0000-4000-8000-000000000004', 'Pink',   '#F92998', 3),
  ('33333333-0000-4000-8000-000000000034', '22222222-0000-4000-8000-000000000004', 'Purple', '#8A4FD9', 4),
  ('33333333-0000-4000-8000-000000000035', '22222222-0000-4000-8000-000000000004', 'Custom', NULL,      5),
  -- Decor
  ('33333333-0000-4000-8000-000000000041', '22222222-0000-4000-8000-000000000005', 'Plants',    NULL, 1),
  ('33333333-0000-4000-8000-000000000042', '22222222-0000-4000-8000-000000000005', 'Books',     NULL, 2),
  ('33333333-0000-4000-8000-000000000043', '22222222-0000-4000-8000-000000000005', 'Candles',   NULL, 3),
  ('33333333-0000-4000-8000-000000000044', '22222222-0000-4000-8000-000000000005', 'Neon Sign', NULL, 4),
  ('33333333-0000-4000-8000-000000000045', '22222222-0000-4000-8000-000000000005', 'Minimal',   NULL, 5),
  ('33333333-0000-4000-8000-000000000046', '22222222-0000-4000-8000-000000000005', 'None',      NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- A few options only make sense on particular sets. Anything with no rows here
-- is offered everywhere.
INSERT INTO set_option_sets (set_option_id, studio_set_id) VALUES
  ('33333333-0000-4000-8000-000000000022', '11111111-0000-4000-8000-000000000001'), -- Podcast Table
  ('33333333-0000-4000-8000-000000000023', '11111111-0000-4000-8000-000000000003'), -- Desk
  ('33333333-0000-4000-8000-000000000021', '11111111-0000-4000-8000-000000000001'), -- Coffee Table
  ('33333333-0000-4000-8000-000000000021', '11111111-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- External rental add-ons
-- ---------------------------------------------------------------------------
INSERT INTO addons (id, name, description, price_cents, sort_order) VALUES
  ('44444444-0000-4000-8000-000000000001', 'Additional Camera',    'A fourth angle, operated or locked off.',        15000, 1),
  ('44444444-0000-4000-8000-000000000002', 'Additional Microphone','Extra wired seat at the table.',                  5000, 2),
  ('44444444-0000-4000-8000-000000000003', 'Teleprompter',         'Confidence monitor with an operator on cue.',    12500, 3),
  ('44444444-0000-4000-8000-000000000004', 'Engineer / Producer',  'Studio 954 engineer running the session.',       25000, 4),
  ('44444444-0000-4000-8000-000000000005', 'Livestream',           'Single-destination live output with monitoring.',30000, 5),
  ('44444444-0000-4000-8000-000000000006', 'Editing',              'Post-production, quoted per finished minute.',   40000, 6),
  ('44444444-0000-4000-8000-000000000007', 'Additional Lighting',  'Extra practicals and accent fixtures.',           8000, 7),
  ('44444444-0000-4000-8000-000000000008', 'Custom Studio Setup',  'Room built to a supplied reference before call time.', 20000, 8)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sample bookings, anchored to today in the studio's timezone
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  today date := (timezone('America/New_York', now()))::date;
BEGIN
  -- FAMA Podcast — today, mid-morning
  INSERT INTO bookings (id, title, kind, booking_type, status, client_name,
                        starts_at, ends_at, setup_minutes, reset_minutes,
                        studio_set_id, organizer_name, organizer_email, organizer_phone,
                        notes, internal_notes, microphone_count)
  VALUES ('55555555-0000-4000-8000-000000000001', 'FAMA Podcast', 'internal', 'podcast', 'upcoming', 'FAMA',
          (today + time '10:00') AT TIME ZONE 'America/New_York',
          (today + time '12:00') AT TIME ZONE 'America/New_York',
          30, 30,
          '11111111-0000-4000-8000-000000000001', 'Drew Mitchell', 'drew@xpressdjs.com', '954-555-0142',
          'Recording three episodes back to back.',
          'Guest parking confirmed. Second camera stays on the wide.', 3)
  ON CONFLICT (id) DO NOTHING;

  -- Xpress Content — today, early afternoon
  INSERT INTO bookings (id, title, kind, booking_type, status, client_name,
                        starts_at, ends_at, setup_minutes, reset_minutes,
                        studio_set_id, organizer_name, organizer_email,
                        notes, microphone_count)
  VALUES ('55555555-0000-4000-8000-000000000002', 'Xpress Content Shoot', 'internal', 'social_content', 'upcoming', 'Xpress Entertainment',
          (today + time '13:00') AT TIME ZONE 'America/New_York',
          (today + time '14:30') AT TIME ZONE 'America/New_York',
          15, 15,
          '11111111-0000-4000-8000-000000000003', 'Alicia Ramos', 'alicia@xpressdjs.com',
          'Vertical cutdowns for the fall campaign.', 1)
  ON CONFLICT (id) DO NOTHING;

  -- External rental — today, late afternoon
  INSERT INTO bookings (id, title, kind, booking_type, status, client_name,
                        starts_at, ends_at, setup_minutes, reset_minutes,
                        studio_set_id, organizer_name, organizer_email, organizer_phone,
                        notes, microphone_count)
  VALUES ('55555555-0000-4000-8000-000000000003', 'Coastline Capital Interview', 'external', 'interview', 'upcoming', 'Coastline Capital',
          (today + time '16:00') AT TIME ZONE 'America/New_York',
          (today + time '18:00') AT TIME ZONE 'America/New_York',
          30, 30,
          '11111111-0000-4000-8000-000000000002', 'Marcus Bell', 'marcus@coastlinecap.com', '954-555-0188',
          'Two principals on camera, seated. Clean corporate look.', 2)
  ON CONFLICT (id) DO NOTHING;

  -- Studio 954 promo — tomorrow
  INSERT INTO bookings (id, title, kind, booking_type, status, client_name,
                        starts_at, ends_at, setup_minutes, reset_minutes,
                        studio_set_id, organizer_name, organizer_email, microphone_count)
  VALUES ('55555555-0000-4000-8000-000000000004', 'Studio 954 Promo Shoot', 'internal', 'photoshoot', 'upcoming', 'Studio 954',
          (today + 1 + time '11:00') AT TIME ZONE 'America/New_York',
          (today + 1 + time '15:00') AT TIME ZONE 'America/New_York',
          30, 30,
          '11111111-0000-4000-8000-000000000004', 'Drew Mitchell', 'drew@xpressdjs.com', 0)
  ON CONFLICT (id) DO NOTHING;

  -- External podcast rental — later in the week
  INSERT INTO bookings (id, title, kind, booking_type, status, client_name,
                        starts_at, ends_at, setup_minutes, reset_minutes,
                        studio_set_id, organizer_name, organizer_email, organizer_phone,
                        notes, microphone_count)
  VALUES ('55555555-0000-4000-8000-000000000005', 'The Overtime Room', 'external', 'podcast', 'upcoming', 'Overtime Media',
          (today + 3 + time '09:30') AT TIME ZONE 'America/New_York',
          (today + 3 + time '12:30') AT TIME ZONE 'America/New_York',
          30, 30,
          '11111111-0000-4000-8000-000000000001', 'Renee Alvarez', 'renee@overtimemedia.co', '305-555-0119',
          'Four-seat table. Host brings their own intro bed.', 4)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Studio setups for the sample bookings
INSERT INTO booking_set_options (booking_id, set_option_id) VALUES
  -- FAMA Podcast: beige curtain, tan chairs, coffee table, warm light, plants + books
  ('55555555-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000003'),
  ('55555555-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000012'),
  ('55555555-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000021'),
  ('55555555-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000031'),
  ('55555555-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000041'),
  ('55555555-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000042'),
  -- Xpress Content: black curtain, stools, desk, pink accent, minimal
  ('55555555-0000-4000-8000-000000000002', '33333333-0000-4000-8000-000000000001'),
  ('55555555-0000-4000-8000-000000000002', '33333333-0000-4000-8000-000000000013'),
  ('55555555-0000-4000-8000-000000000002', '33333333-0000-4000-8000-000000000023'),
  ('55555555-0000-4000-8000-000000000002', '33333333-0000-4000-8000-000000000033'),
  ('55555555-0000-4000-8000-000000000002', '33333333-0000-4000-8000-000000000045'),
  -- Coastline Capital: white curtain, black lounge chairs, coffee table, warm, minimal
  ('55555555-0000-4000-8000-000000000003', '33333333-0000-4000-8000-000000000002'),
  ('55555555-0000-4000-8000-000000000003', '33333333-0000-4000-8000-000000000011'),
  ('55555555-0000-4000-8000-000000000003', '33333333-0000-4000-8000-000000000021'),
  ('55555555-0000-4000-8000-000000000003', '33333333-0000-4000-8000-000000000031'),
  ('55555555-0000-4000-8000-000000000003', '33333333-0000-4000-8000-000000000045'),
  -- Studio 954 promo: white backdrop, no chairs, none, custom light, minimal
  ('55555555-0000-4000-8000-000000000004', '33333333-0000-4000-8000-000000000002'),
  ('55555555-0000-4000-8000-000000000004', '33333333-0000-4000-8000-000000000014'),
  ('55555555-0000-4000-8000-000000000004', '33333333-0000-4000-8000-000000000024'),
  ('55555555-0000-4000-8000-000000000004', '33333333-0000-4000-8000-000000000035'),
  ('55555555-0000-4000-8000-000000000004', '33333333-0000-4000-8000-000000000045'),
  -- The Overtime Room: black curtain, black lounge chairs, podcast table, blue, neon sign
  ('55555555-0000-4000-8000-000000000005', '33333333-0000-4000-8000-000000000001'),
  ('55555555-0000-4000-8000-000000000005', '33333333-0000-4000-8000-000000000011'),
  ('55555555-0000-4000-8000-000000000005', '33333333-0000-4000-8000-000000000022'),
  ('55555555-0000-4000-8000-000000000005', '33333333-0000-4000-8000-000000000032'),
  ('55555555-0000-4000-8000-000000000005', '33333333-0000-4000-8000-000000000044')
ON CONFLICT DO NOTHING;

INSERT INTO booking_attendees (id, booking_id, name, email, notify) VALUES
  ('66666666-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001', 'Drew Mitchell',  'drew@xpressdjs.com',       true),
  ('66666666-0000-4000-8000-000000000002', '55555555-0000-4000-8000-000000000001', 'Tasha Green',    'tasha@famamedia.com',      true),
  ('66666666-0000-4000-8000-000000000003', '55555555-0000-4000-8000-000000000001', 'Andre Cole',     'andre@famamedia.com',      false),
  ('66666666-0000-4000-8000-000000000004', '55555555-0000-4000-8000-000000000003', 'Marcus Bell',    'marcus@coastlinecap.com',  true),
  ('66666666-0000-4000-8000-000000000005', '55555555-0000-4000-8000-000000000003', 'Priya Raman',    'priya@coastlinecap.com',   true),
  ('66666666-0000-4000-8000-000000000006', '55555555-0000-4000-8000-000000000005', 'Renee Alvarez',  'renee@overtimemedia.co',   true),
  ('66666666-0000-4000-8000-000000000007', '55555555-0000-4000-8000-000000000005', 'Jules Whitfield','jules@overtimemedia.co',   true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO booking_addons (booking_id, addon_id, quantity, price_cents_at_booking) VALUES
  ('55555555-0000-4000-8000-000000000005', '44444444-0000-4000-8000-000000000002', 2,  5000),
  ('55555555-0000-4000-8000-000000000005', '44444444-0000-4000-8000-000000000004', 1, 25000),
  ('55555555-0000-4000-8000-000000000003', '44444444-0000-4000-8000-000000000003', 1, 12500)
ON CONFLICT DO NOTHING;

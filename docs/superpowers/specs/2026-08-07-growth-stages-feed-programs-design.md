# Growth Stages & Feed Programs Design

## Overview
Model chicken growth stages using the existing `catalogos` system and a new `feed_programs` table. Stages are age-based (weeks), auto-computed from each hen's `birthDate`. Feed programs define the diet composition per stage with percentages and daily amounts per hen.

## Data Model Changes

### 1. `catalogos` table — new columns
Add `minWeeks` (integer, nullable) and `maxWeeks` (integer, nullable) columns. Only used when `category = 'etapa_crecimiento'`.

### 2. Seed data — new catalog entries
Add category `etapa_crecimiento` with standard poultry stages:
- Pollito: 0–6 weeks
- Juvenil: 6–18 weeks
- Pre-postura: 18–20 weeks
- Postura: 20+ weeks (maxWeeks = null)

### 3. New table `feed_programs`
```
id              uuid PK
stageCatalogoId uuid FK → catalogos.id
feedId          uuid FK → feed_inventory.id
percentage      decimal(5,2) — % of total diet
dailyAmountPerHen decimal(6,2) — grams/hen/day
createdAt       timestamp
updatedAt       timestamp
UNIQUE(stageCatalogoId, feedId)
```

### 4. `feed_movements` table — new columns
Add `stageCatalogoId` (uuid, nullable, FK → catalogos.id) and `henCount` (integer, nullable).

## Logic

### Stage auto-computation
```
weeks = (today - hen.birthDate) / 7
```
Match against catalogos `etapa_crecimiento` entries where `minWeeks <= weeks < maxWeeks`.

### Group auto-formation
All active hens in the same stage form a group. Group size = count of hens in that stage.

### Expected consumption
For each stage group:
```
expectedDaily = henCount × dailyAmountPerHen (per feed in program)
```

## UI Changes

### Alimentación page — new "Etapas y Programas" tab
- List stages from catalogos with week ranges
- Expandable: show feed program (feeds + percentages + grams/hen/day)
- Add/edit feed programs per stage

### Gallinas page — stage badge
- Show computed stage as a badge next to each hen
- Filter by stage

### Alimentación movements — stage context
- When registering consumption, select target stage
- Show hen count for that stage
- Show expected vs actual consumption

## API Changes

### New endpoints
- `GET /api/etapas` — list growth stages from catalogos with week ranges
- `GET /api/etapas/[id]/programa` — get feed program for a stage
- `POST /api/etapas/[id]/programa` — add/update feed program entries

### Modified endpoints
- `GET /api/alimentacion/movimientos` — include stage info and hen count
- `POST /api/alimentacion/movimientos` — accept stageCatalogoId and henCount

CREATE TABLE IF NOT EXISTS contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(200) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'cliente',
  person_type varchar(20) NOT NULL DEFAULT 'natural',
  document_type varchar(20),
  document_number varchar(50),
  contact_name varchar(150),
  phone varchar(40),
  whatsapp varchar(40),
  email varchar(150),
  address text,
  city varchar(120),
  department varchar(120),
  zone varchar(120),
  location_notes text,
  category_tag varchar(80),
  payment_method varchar(40),
  credit_days integer NOT NULL DEFAULT 0,
  delivery_schedule varchar(120),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_name_idx ON contacts (name);


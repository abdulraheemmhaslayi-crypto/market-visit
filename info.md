Login 
 authenticate the supervisor; keep their identity for the session.
 Select outlet — pick Route, then Customer. Customers filtered strictly to the selected route (see §6). On customer select, show Classification (A–E) and Channel.
 
 Capture — multiple photos for Dairy, Beverages, Fruits, Vegetables; Asset dropdown (Chiller/Freezer) + temperature; mandatory Action Required + optional Observations.

 NPD check — list NPD SKUs; each gets one of three states: Available / Not available / Not required.

 Review & submit — read-back, capture GPS, submit to the API.

 Validation: block submit until Route, Customer, and Action Required are set and GPS has returned. Compute a TempInRange flag — chiller valid 0–8°C, freezer valid below −15°C — and surface a warning in the UI when out of range.



Master data & sync
Masters are maintained as Excel files (routes; customers with the CustomerCode|RouteCode mapping; SKUs; and a customer classification file with A–E grade + channel). They change several times a week. Provide an admin import (upload Excel → upsert into the master tables, keyed on the primary keys above, e.g. cust_rt_id for customers). Upsert semantics: insert new, update changed, and mark/remove pairings no longer present. Do not require a redeploy to update master data.
 Reporting
Expose visit data for analytics. Either build simple dashboard pages (visits over time, coverage per route, temperature breaches, supervisor scorecard) or provide a read API / DB views the company’s Power BI can connect to. Key metrics:
●	Coverage % = distinct customers visited on a route ÷ customers assigned to that route (distinct cust_rt_id).
●	Breach % = visits with temp_in_range = false ÷ total visits.
●	Visits and outlets visited per supervisor, per day.

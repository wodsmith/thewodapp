# CRM CrossFit metadata

The CRM stores a gym's official CrossFit profile URL separately from its general website so sales and operations workflows can distinguish the affiliate source of truth from ordinary web presence.

When a CrossFit profile URL includes an affiliate identifier, the CRM derives that identifier for display and search instead of requiring manual duplicate entry. Supported profile URLs include standard CrossFit gym/affiliate paths and CrossFit Games affiliate paths.

Local CRM development seed data should include the CrossFit Page field definition so developers can create and inspect gym records with the same metadata shape used in production.

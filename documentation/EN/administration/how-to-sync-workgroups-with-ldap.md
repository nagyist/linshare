# How to synchronize LinShare workgroups with LDAP groups — Sysadmin runbook

This runbook walks an operator through enabling LDAP-driven workgroup synchronization on a running LinShare instance: pre-flight checks, LDAP schema mapping, admin-UI configuration, server-side cron tuning, validation, and troubleshooting.


> Naming note: the **legacy admin UI** uses *workgroup pattern* and *workgroup provider*. The **new admin portal** renames them to *group filter* and *group provider*. Same objects, same data model.

## Summary

* [1. Prerequisites and pre-flight checks](#1-prerequisites-and-pre-flight-checks)
* [2. Plan your LDAP schema mapping](#2-plan-your-ldap-schema-mapping)
* [3. Create the LDAP connection](#3-create-the-ldap-connection)
* [4. Create the workgroup pattern / group filter](#4-create-the-workgroup-pattern--group-filter)
* [5. Attach the group provider to a domain](#5-attach-the-group-provider-to-a-domain)
* [6. Configure the synchronization cron on the server](#6-configure-the-synchronization-cron-on-the-server)
* [7. Trigger and validate the first synchronization](#7-trigger-and-validate-the-first-synchronization)
* [8. Operational behavior to know](#8-operational-behavior-to-know)
* [9. Troubleshooting](#9-troubleshooting)
* [10. Rollback](#10-rollback)

## 1. Prerequisites and pre-flight checks

Before touching the admin UI, verify each of the following on a host that has network access to both LinShare and the directory:

| Check | Command / where | Expected result |
|---|---|---|
| LinShare reachable | `curl -I https://<linshare-host>/` | `200` / login redirect |
| LDAP reachable | `nc -zv <ldap-host> 389` (or `636` for LDAPS) | `succeeded` |
| Bind credentials valid | `ldapwhoami -x -H ldaps://<ldap-host> -D '<bindDN>' -W` | `dn:<bindDN>` |
| Groups present at base DN | `ldapsearch -x -H ldaps://<ldap-host> -D '<bindDN>' -W -b 'ou=Groups,dc=example,dc=org' '(objectClass=posixGroup)' dn` | non-empty list |
| LinShare service writable | `systemctl status tomcat9` (or your unit) | `active (running)` |

You must have:

* a **root / super-admin** LinShare account,
* a **target nested domain** to attach the provider to. Per [story-27 post-conditions](../epics/new-admin-portal/story-27-admin-manage-group-provider.md), root domains and guest domains **cannot** carry a group provider,
* shell access to the LinShare server (to edit `linshare.properties` and restart Tomcat).

## 2. Plan your LDAP schema mapping

Inventory your directory and decide the mapping **before** opening the UI. Worked example for the `posixGroup` schema documented in [ldap.md §2](ldap.md#2-define-a-workgroup-pattern):

LDAP user entry:

```ldif
dn: uid=test1,ou=People,dc=linshare,dc=org
uid: test1
objectClass: inetOrgPerson
sn: Test1
cn: Test, Test1
mail: test1@linshare.org
```

LDAP workgroup entry:

```ldif
dn: cn=workgroup-wg-1,ou=Groups,dc=linshare,dc=org
cn: workgroup-wg-1
objectClass: posixGroup
member: uid=test1,ou=People,dc=linshare,dc=org
member: uid=test2,ou=People,dc=linshare,dc=org
```

Resulting mapping:

| LinShare field | LDAP value |
|---|---|
| Member email | `mail` |
| Member first name | `givenName` |
| Member last name | `sn` |
| Workgroup prefix *(optional)* | `workgroup-` |
| Workgroup name | `cn` |
| Workgroup member | `member` |
| Search page size | `100` |

### Optional: model LinShare roles inside LDAP

LinShare reads role child entries under each workgroup. Create one child per role:

```ldif
dn: cn=writers,cn=workgroup-wg-1,ou=Groups,dc=linshare,dc=org
cn: writers
objectClass: posixGroup
member: uid=test1,ou=People,dc=linshare,dc=org
```

`cn` of the child entry must be one of:

* `writers`
* `contributors`

Members of the parent group with no matching child entry get the **READER** role by default. Source: [ldap.md §2 "Role access management"](ldap.md#2-define-a-workgroup-pattern).

### Pre-validate your queries

Run the same searches the LinShare batch will run, *before* configuring it:

```bash
# "Search all workgroups" — should return every workgroup DN you want LinShare to see
ldapsearch -x -H ldaps://<ldap-host> -D '<bindDN>' -W \
  -b 'ou=Groups,dc=linshare,dc=org' \
  '(objectClass=posixGroup)' dn cn member

# "Search workgroup" — should return exactly one workgroup
ldapsearch -x -H ldaps://<ldap-host> -D '<bindDN>' -W \
  -b 'ou=Groups,dc=linshare,dc=org' \
  '(&(objectClass=posixGroup)(cn=workgroup-wg-1))' dn cn member
```

If either query is wrong now, it will be wrong inside LinShare. Fix it here.

## 3. Create the LDAP connection

| UI | Path |
|---|---|
| Legacy admin | `Domains > LDAP connections > Add` |
| New admin portal | `Configuration > Remote servers > LDAP connections > Create` |

Required fields:

* **Name** — operator-facing label.
* **Provider URL** — `ldaps://host:636` (LDAPS recommended).
* **Principal (Bind DN)** — service account, e.g. `cn=linshare,ou=Services,dc=linshare,dc=org`.
* **Credential** — bind password.

Click **Save**, then re-open the connection and use any "Test" affordance the UI exposes. If you already have an LDAP connection feeding **users**, you can reuse it — there is no operational reason to duplicate it.

## 4. Create the workgroup pattern / group filter

| UI | Path |
|---|---|
| Legacy admin | `Domains > Workgroup patterns > Add` |
| New admin portal | `Configuration > Remote filters > Group filters > Create` |

In the new portal, the **Model selector** drop-down has an `Ldap groups` option that pre-fills every field except *Name* — start there and adjust ([story-26 UC1](../epics/new-admin-portal/story-26-admin-create-Duplicate-Edit-Delete-group-filter.md)).

Fill in:

| Field | Mandatory | Example |
|---|:---:|---|
| Name | yes | `posixGroup-pattern` |
| Description | no | `Sync OU=Groups posixGroup entries` |
| Search all workgroups query | yes | `(objectClass=posixGroup)` |
| Search workgroup query | yes | `(&(objectClass=posixGroup)(cn=*${pattern}*))` |
| Workgroup prefix | no | `workgroup-` |
| Search page size | yes | `100` |
| Member email | yes | `mail` |
| Member first name | yes | `givenName` |
| Member last name | yes | `sn` |
| Workgroup name | yes | `cn` |
| Workgroup member | yes | `member` |

Click **Save**. Mandatory blanks are highlighted with `[field name] cannot be blank` ([story-26 UC1](../epics/new-admin-portal/story-26-admin-create-Duplicate-Edit-Delete-group-filter.md)).

## 5. Attach the group provider to a domain

| UI | Path |
|---|---|
| Legacy admin | open target nested domain → workgroup-provider section |
| New admin portal | select nested domain in tree → `Configuration > Providers > Group Providers > Add Group provider` |

Required fields ([story-27 UC1](../epics/new-admin-portal/story-27-admin-manage-group-provider.md)):

* **LDAP connection** — pick the one from step 3.
* **Group filter** — pick the one from step 4.
* **Base DN** — the subtree containing the workgroup entries, e.g. `ou=Groups,dc=linshare,dc=org`. Tooltip: *"LinShare will start looking for group members from this position in your LDAP."*
* **Search in other domains** *(checkbox)* — enable only if you accept members from other LinShare domains. Resolution then follows `Domains > Inter-domains communication rules`.

Click **Save**.

> A nested domain has **at most one** group provider. Editing it later opens the same screen with all fields editable; **Reset** rolls back unsaved changes; **Delete** asks for confirmation and detaches the provider ([story-27 UC2/UC3](../epics/new-admin-portal/story-27-admin-manage-group-provider.md)).

## 6. Configure the synchronization cron on the server

The synchronization batch is scheduled by `linshare-core`, not the UI. On the LinShare server, edit `linshare.properties`:

```properties
# This cron is responsible of:
#   - synchronizing LdapGroups with Workgroups
# Default: every 4 hours, on the hour
job.ldapgroups.cron.expression=0 0 0/4 * * ?
```

Common values:

| Cadence | Expression |
|---|---|
| Every 4 hours (default) | `0 0 0/4 * * ?` |
| Every hour | `0 0 * * * ?` |
| Every 15 minutes | `0 0/15 * * * ?` |
| Every day at 02:30 | `0 30 2 * * ?` |

Apply:

```bash
sudo systemctl restart tomcat9   # or your LinShare unit
sudo systemctl status  tomcat9
```

Source: [ldap.md §4](ldap.md#4-configure-the-synchronization-schedule).

## 7. Trigger and validate the first synchronization

You have two options:

1. **Wait for the next cron tick.** Tail the LinShare log:

   ```bash
   sudo tail -F /var/log/linshare/linshare.log | grep -iE 'ldap|workgroup|batch'
   ```

2. **Force a run by restarting** Tomcat (most LinShare versions kick scheduled batches near startup) and watch the same log.

Validate end-to-end:

| Check | Where | Expected |
|---|---|---|
| Workgroups appear in LinShare | admin UI → domain → workgroups list | one entry per LDAP group, prefix stripped |
| Members are populated | open a workgroup | LDAP member DNs resolved to LinShare users |
| Roles are correct | open a workgroup | members of `cn=writers,…` are *writers*, `cn=contributors,…` are *contributors*, the rest are *readers* |
| No errors in the log | `linshare.log` | no `ERROR`/stack traces from the LDAP batch |

If the first run produced *zero* workgroups, jump to [§9 Troubleshooting](#9-troubleshooting) — do not change the cron and walk away.

## 8. Operational behavior to know

> **The LDAP directory is authoritative. Synchronization is one-way: LDAP → LinShare.**

Source: [ldap.md §5](ldap.md#5-more-about-the-synchronization).

* A user removed from the LDAP `member` list is **removed from the LinShare workgroup** at the next run.
* An LDAP group deleted upstream causes **all members to be stripped** from the matching LinShare workgroup. The workgroup itself is **kept on purpose** so uploaded documents are not lost. Operators must delete it manually if the group is decommissioned.
* Renames in LDAP (changing `cn`) produce a *new* LinShare workgroup. Plan renames as `create-new` + `migrate-content` + `delete-old`.
* Membership changes in LDAP take effect at the next cron run, **not** immediately.

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No workgroups appear after sync | "Search all workgroups query" returns nothing under the configured Base DN | Re-run the `ldapsearch` from §2 against the **exact** Base DN configured in §5; adjust query or Base DN |
| Workgroups appear but with no members | `Workgroup member` attribute mismatch (e.g. directory uses `uniqueMember` not `member`) | Update the group filter (§4) and wait for next run |
| Members appear with wrong / missing names | `Member first name` / `Member last name` mapped to attributes the directory does not populate | Adjust mapping; some directories use `gn` instead of `givenName` |
| Members exist in LDAP but not resolved in LinShare | Members live in another LinShare domain and `Search in other domains` is **off**, **or** inter-domain rules forbid it | Enable the checkbox in §5 and review `Domains > Inter-domains communication rules` |
| All members end up as READER even with `cn=writers,…` | Role child entries are not under the workgroup DN, or `cn` is not exactly `writers` / `contributors` | See §2 "Optional: model LinShare roles in LDAP" |
| Bind succeeds with `ldapwhoami` but LinShare logs `LDAPException: Invalid Credentials` | Password contains a character mangled in the UI (e.g. `&`) | Re-enter the credential, prefer copy-paste from a password manager |
| Sync runs but log shows `SizeLimitExceededException` | Result set exceeds the directory limit; `Search page size` not used by your directory | Lower `Search page size`, or raise the directory's `nsslapd-sizelimit` / equivalent |
| Sync never runs | Cron expression invalid or batch disabled | Check `linshare.log` at startup for cron parse errors; restore default `0 0 0/4 * * ?` |

Useful one-liners:

```bash
# Show only the LDAP batch lines from the current log
sudo grep -iE 'ldap.*workgroup|workgroup.*sync|LdapGroup' /var/log/linshare/linshare.log

# Resolve a member DN as LinShare will
ldapsearch -x -H ldaps://<ldap-host> -D '<bindDN>' -W \
  -b 'uid=test1,ou=People,dc=linshare,dc=org' '(objectClass=*)' mail givenName sn
```

## 10. Rollback

If you need to disable synchronization without losing data:

1. **Detach the group provider** from the domain (admin UI → domain → group provider → **Delete**).
   * Existing LinShare workgroups and their content are kept; future syncs no longer touch them.
2. **Optionally remove** the group filter and LDAP connection if no other domain uses them. The new portal warns when a filter is still associated with a domain ([story-26 UC4](../epics/new-admin-portal/story-26-admin-create-Duplicate-Edit-Delete-group-filter.md)).
3. **Optionally restore the default cron** in `linshare.properties` and restart Tomcat. Leaving the cron set is harmless once no domain has a provider.

Synchronization being one-way means rollback never deletes documents — only the link between LDAP groups and LinShare workgroups is severed.

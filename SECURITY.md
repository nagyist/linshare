# Security policy

## Reporting a vulnerability

Please do **not** report security vulnerabilities through public GitHub issues, pull requests or
discussions.

Report them privately through GitHub's private vulnerability reporting: go to the
[Security tab](https://github.com/linagora/linshare/security) of this repository and click
**Report a vulnerability**, or open the form directly:
https://github.com/linagora/linshare/security/advisories/new

Include, as far as you can:

- the LinShare version and component affected (core, ui-user, ui-admin, ui-upload-request, plugins);
- a description of the issue and its impact;
- steps to reproduce, or a proof of concept;
- whether the issue is already public elsewhere.

You will receive an acknowledgement, and we will keep you informed of the progress of the fix.
Please give us a reasonable time to publish a fix before disclosing the issue publicly.

## Supported versions

Security fixes are published on the latest release line. If you run an older version, upgrade
following the [upgrade guides](documentation/EN/upgrade/README.md). Fixed vulnerabilities are listed
in [CHANGELOG.md](CHANGELOG.md).

## Keeping your instance secure

- Keep LinShare and its dependencies (JVM, Tomcat, PostgreSQL, MongoDB, Apache) at the versions
  given in the [compatibility matrix](documentation/EN/installation/requirements.md).
- Serve LinShare over HTTPS only and restrict the Tomcat, PostgreSQL and MongoDB ports to the
  application host, as described in the
  [exploitation guide](documentation/EN/administration/exploitation-administration.md).
- Enable antivirus scanning (ClamAV) and review the sharing, guest and upload-request policies in
  the administration interface.

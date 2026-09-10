# Contributing to LinShare

Thank you for taking the time to contribute. This page explains where things happen and how a
change makes its way into LinShare.

## Where development happens

The canonical repositories are hosted on Linagora's GitLab under
`ci.linagora.com/linagora/lgs/linshare`. The GitHub organization
[linagora](https://github.com/linagora) is a mirror. Pull requests opened on GitHub are reviewed and
then integrated upstream, so both are fine as an entry point.

LinShare is split into several repositories. This one, `linshare`, is the **meta repository**: it
holds the user-facing documentation, the EPIC and user-story specifications, and the Maven
aggregator that pins component versions for a release. The code lives in the component repositories
listed in the [README](README.md#components).

## Reporting bugs and requesting features

- Open the issue on the repository of the component concerned: `linshare-core` for the server and
  API, `linshare-ui-user`, `linshare-ui-admin` or `linshare-ui-upload-request` for the web
  interfaces, `linshare-plugin-thunderbird` for the mail extension.
- Issues about the documentation belong in this repository.
- Include the LinShare version (visible in the administration interface), the browser or client,
  and the steps to reproduce.
- For security issues, do not open a public issue. See [SECURITY.md](SECURITY.md).

## Documentation and translations

All guides live under `documentation/<EN|FR|RU>/`, one tree per language, each with a `README.md`
index. When you add or rename a page:

- update the `README.md` index of that folder;
- keep the other language trees in step where you can. The French and Russian trees lag behind
  English; a link to the English page marked `[EN]` is the convention while a translation is pending;
- screenshots go under `documentation/img/`.

## Specifying a feature: EPICs and user stories

New features are specified before they are developed. Each feature is an **EPIC** with one or more
**user stories**, stored under [`documentation/EN/epics/`](documentation/EN/epics/):

```
epics/<epic-name>/
├── README.md                              # follows template-epic.md
├── resources/                             # screenshots, mockups, attachments
└── story-<issue#>-<actor>-<action>.md     # one file per story, follows template-story.md
```

Folder names are dash-separated (`upload-requests`, `new-admin-portal`). Templates:
[template-epic.md](documentation/EN/epics/template-epic.md) and
[template-story.md](documentation/EN/epics/template-story.md). GitLab issue templates for EPICs and
stories are in [`.gitlab/issue_templates/`](.gitlab/issue_templates/).

The full process, including the `EPIC::*` and `STORY::*` label workflow, review steps and who is
involved at each stage, is described in:

- [Story definition](documentation/EN/development/workflow/story-definition.md)
- [Development workflow](documentation/EN/development/workflow/development.md), which also documents
  the severity, priority and state labels used on issues, and how releases and milestones are handled.

## Code contributions

1. Fork the component repository and create a branch from `master`, or from the relevant
   `maintenance-<major>.<minor>.x` branch for a fix to a released version.
2. Follow the conventions of that repository (build, tests, linting are documented there). The
   [developer guide](documentation/EN/development/README.md) covers IDE setup for `linshare-core`
   and how to add emails and upgrade tasks.
3. Open a merge request (GitLab) or pull request (GitHub) that references the issue it addresses.
   Keep it focused: one change per request.
4. A maintainer reviews it. Expect requests for changes; the discussion happens on the request.

## Releases

Release notes are in [CHANGELOG.md](CHANGELOG.md). Packages are published at
http://download.linshare.org/versions/. Component versions for a release are pinned in
[pom.xml](pom.xml), and the compatibility matrix (OS, JVM, PostgreSQL, MongoDB, Tomcat, Apache) is
kept in [requirements.md](documentation/EN/installation/requirements.md).

## License

By contributing you agree that your contribution is licensed under the
[GNU Affero General Public License v3](LICENSE.md), like the rest of LinShare.

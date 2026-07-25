# Restore Order

1. Install Ubuntu.
2. Update the system.
3. Configure hostname and timezone.
4. Mount final storage.
5. Create service users and groups.
6. Install Docker and Podman.
7. Install Tailscale.
8. Restore secrets.
9. Deploy RustDesk.
10. Deploy Apollo empty.
11. Validate databases and DICOM.
12. Deploy monitoring.
13. Deploy stable CimaSim.
14. Install the custom dispatcher from a verified artifact.
15. Execute rootless gates.
16. Enable custom execution only at the end.
17. Run `verify-all`.
18. Keep the previous disk as temporary rollback media.

## Dependency Notes

- Tailscale should be available before services that bind only to the tailnet.
- Secrets must be restored before Compose services are started.
- Apollo should be rebuilt empty because no real clinical data is present.
- Monitoring should start before the final CimaSim gate.
- PR #15 remains draft until custom dispatcher provenance and idle gates pass.

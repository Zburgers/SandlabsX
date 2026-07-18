# Capsule threat model

Capsule documents, image metadata, and Scenario inputs are untrusted. Images require managed QCOW2 provenance and digest validation; guest execution is isolated from host shell evaluation; runtime paths are ownership-checked; and evidence is bounded and redacted.

Administrator, runner, and database credentials are separate trust boundaries. Console grants must be scoped and short-lived. External connectors, arbitrary verifier plugins, arbitrary host scripts, unrestricted forwarding, cross-instance networking, and unqualified images are unsupported.

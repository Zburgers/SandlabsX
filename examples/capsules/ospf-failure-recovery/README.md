# OSPF failure and recovery Capsule

This reference Capsule is intentionally portable and does not include a router image. Resolve the `router` image to a managed, legally usable QCOW2 image and replace the example digest before publishing.

The separate Scenario fixture is at `backend/test/fixtures/scenarios/ospf-failure-recovery.json`; publication must replace its exact Capsule-version placeholder. It uses only typed checks:

- `topologyPlan` proves that the published links compile to the expected three-node triangle.
- `serialOutput` looks for `OSPF FULL` in the router's bounded, redacted serial evidence.

The expected workflow is: publish the resolved Capsule, create an instance, create the initial stopped checkpoint, inject or observe a transit failure, repair the interface, run the checks, and restore the checkpoint to reset. Arbitrary author scripts remain disabled by policy.

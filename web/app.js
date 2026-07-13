(() => {
  "use strict";

  const STORE_SCHEMA = "priority_foregrounds.workspace/v4";
  const REQUEST_SCHEMA = "priority_foregrounds.rescore_request/v1";
  const RESULT_SCHEMA = "priority_foregrounds.rescore_result/v1";
  const SESSION_SCHEMA = "priority_foregrounds.session/v1";
  const STATUS_LABELS = { "blocked": "Blocked", "in-progress": "In Progress", "done": "Done", "deferred": "Deferred" };
  const names = ["customer", "leverage", "ai_leverage", "urgency", "cost", "security"];
  const presets = {
    balanced: [24, 20, 16, 14, 14, 12],
    customer: [46, 16, 10, 10,  8, 10],
    leverage: [12, 38, 16, 12,  8, 14],
    margin:   [17, 12, 12, 12, 32, 15],
  };
  const principles = {
    customer: {
      name: "Customer value",
      prompt: "Score how directly the initiative solves an urgent, specific customer problem that a real buyer is likely to pay to resolve. A 5 has a short, credible path to observable customer value; a 1 is remote, speculative, or mainly internal convenience.",
    },
    leverage: {
      name: "Compound return",
      prompt: "Score how much completing this initiative is the single domino that makes future work easier, faster, or unnecessary — the \"One Thing\" that delivers disproportionate downstream value.\n\n90–100: Works ON the system, not IN it. Builds a reusable primitive — platform capability, shared library, automation framework, self-service tooling, or infrastructure pattern — that multiple future initiatives inherit without rework. Removes a recurring structural constraint, eliminates an entire class of toil, or creates a repeatable process that scales beyond the person or team who built it. After it ships, the next engineer to touch this area finds a paved road instead of a blank field.\n\n70–89: Creates meaningful downstream leverage. Unblocks several future initiatives, establishes a pattern others will copy, or replaces a manual process with a durable automated one. The compound return is real but scoped to one domain or team rather than organization-wide.\n\n40–69: Moderate compound value. Unblocks one or two downstream initiatives, or improves an existing process enough that future iterations are measurably faster, but does not create a broadly reusable asset or eliminate a structural bottleneck.\n\n10–39: Minor incidental reuse. The work might inform a future decision or produce a small artifact others reference, but the next similar problem will still require most of the same effort from scratch.\n\n0–9: Isolated task-work. Fixes one problem, for one workload, one time. Nothing else gets easier because it shipped.\n\nWhen scoring, ask: \"If we could only ship one initiative this quarter, would completing this one make everything else on the board easier or unnecessary?\" Score the honest answer to that question.",
    },
    ai_leverage: {
      name: "AI Infrastructure Leverage",
      prompt: "Score how much the initiative creates or strengthens foundational AI infrastructure that multiplies future capability. A 5 builds a reusable primitive — compute sandboxes, data access layers, storage architecture, or agent frameworks — that multiple future AI capabilities depend on without rework; a 1 is isolated work that does not compound into reusable AI capability.",
    },
    urgency: {
      name: "Urgency",
      prompt: "Score how time-sensitive this initiative is, independent of its strategic value. A 5 has a hard external deadline, an actively accumulating penalty (EOL without security patches, extended-support fees, compliance audit gap, tickets due this month), or is blocking other work right now; a 1 can be safely deferred — delay costs nothing and nothing is waiting on it.",
    },
    cost: {
      name: "Cost discipline",
      prompt: "Score how much the initiative makes recurring cost attributable, bounded, or lower while protecting value. A 5 directly measures or materially reduces ongoing spend or improves margin; a 1 adds cost or offers no meaningful cost control.",
    },
    security: {
      name: "Security",
      prompt: "Score the security severity this initiative addresses using a CRITICAL / HIGH / MEDIUM / LOW / NONE framework grounded in security best practices.\n\nCRITICAL (90–100): Active or easily exploitable risk — EOL software with unpatched CVEs in security-critical components (CNI, certificate management, credential stores), missing isolation or authentication boundaries for production systems, active supply-chain compromise vectors, or compliance gaps that constitute a demonstrable breach risk (HIPAA, SOC2). These are fix-now items.\n\nHIGH (70–89): Known CVEs in outdated but not-yet-EOL components, incomplete security controls with a clear exploitation path, key management failures that caused or risk causing incidents, dead-end supply chains with no patch channel, or missing egress attribution required for breach scoping.\n\nMEDIUM (40–69): Security hygiene work that reduces attack surface without an active exploit — undocumented exceptions that are audit findings, RBAC hardening, audit logging for SOC2, access control improvements, or observability tooling that enables security monitoring.\n\nLOW (10–39): Infrastructure work with a minor incidental security benefit — deprecated driver replacement, config drift prevention, or documentation that closes a paper audit finding but does not close an exploitable gap.\n\nNONE (0–9): No meaningful security impact — cost optimization, performance tuning, or feature work with no security surface change.",
    },
  };

  const initiatives = [
    {
      id: "kubelet_133_nodes",
      name: "Nodes stuck on kubelet 1.33 (blocks EKS 1.35)",
      category: "SRE / Infrastructure",
      horizon: "now",
      summary: "7 monitoring nodes (created 2026-04-21, ~80 days old) are on kubelet 1.33 while the control plane is on 1.34. aws eks list-insights reports kubelet version skew — WARNING, the only non-passing EKS insight. Blocks the required upgrade to 1.35 before the 2026-12-02 extended-support deadline (6× fee after that date).",
      customer_value: "Unblocks the EKS 1.35 upgrade, which brings PreferSameNode traffic distribution and avoids the 6× extended-support fee for all cluster users.",
      leverage: "Prerequisite for EKS 1.35, which gates VPA in-place resize, containerd 2.0 readiness, and all downstream cluster optimization work.",
      risk: "Removes the only non-passing EKS upgrade insight and eliminates the path to 6× extended-support charges after 2026-12-02. Nodes are ~3 months behind on AMI patches.",
      ai_fit: "AI can draft the rolling drain runbook and kubectl/jq PV zone-affinity validation commands; SRE owns execution and coordinates with Prometheus/Thanos owners.",
      cost: "Removes the trajectory toward a 6× extended-support fee. Stale AMI replacement also closes an unpatched node security gap.",
      dependency: "PV zone affinity validation (kubectl get pv -o json | jq) before drain. Coordination with monitoring workload owners (Prometheus/Thanos with persistent volumes).",
      proof: "aws eks list-insights shows no kubelet version-skew warning; all 7 monitoring nodes replaced and running kubelet 1.34+. prd-internal nodes (~77 days old) reviewed and scheduled.",
      effort: 3,
      scores: [45, 85, 10, 95, 60, 72],
    },
    {
      id: "eks_upgrade_135",
      name: "EKS Upgrade 1.34 → 1.35 (blocked by kubelet ticket)",
      category: "SRE / Infrastructure",
      horizon: "now",
      summary: "Upgrade EKS clusters to 1.35 to reach N-1 and keep up with patches. 1.35 adds PreferSameNode traffic distribution (latency win for DaemonSet-adjacent traffic) and is the last release supporting containerd 1.x — check node AMIs for containerd 2.0 readiness as part of the same upgrade.",
      customer_value: "Keeps clusters on a supported, patched version and enables PreferSameNode latency improvements for all teams using DaemonSet-adjacent traffic paths.",
      leverage: "Gates VPA in-place resize (1.35 feature), Cilium upgrade path, and containerd 2.0 AMI readiness. N-1 posture reduces future upgrade debt accumulation.",
      risk: "Avoids extended-support charges (6× cost multiplier after 2026-12-02) and unpatched control plane CVEs. Containerd 1.x EOL check is a named gate.",
      ai_fit: "AI can generate pre-flight upgrade checklists and containerd AMI readiness queries; SRE owns the upgrade execution.",
      cost: "Avoiding extended-support fees after 2026-12-02 is the primary financial driver. PreferSameNode reduces cross-zone egress latency at no extra cost.",
      dependency: "Blocked by kubelet 1.33 node replacement. Containerd 2.0 AMI readiness check during upgrade planning.",
      proof: "EKS control plane reports 1.35; all EKS upgrade insights pass; PreferSameNode visible in traffic distribution metrics.",
      effort: 3,
      scores: [50, 90, 40, 85, 65, 75],
    },
    {
      id: "vpa_recommendation_mode",
      name: "Enable VPA in Recommendation Mode (needs EKS 1.35)",
      category: "Cost / SRE",
      horizon: "next",
      summary: "VPA is installed but idle. 221 containers run with no memory limit. Enable recommendation mode for memory-heavy monitoring and app workloads to generate data-driven right-sizing inputs. Feed recommendations into requests/limits and eventually into CastAI or autoscaler for in-place resize (1.35 feature).",
      customer_value: "Provides concrete right-sizing data to teams running overprovisioned or limit-free containers, reducing OOM risk and scheduling waste.",
      leverage: "Feeds CastAI/autoscaler with real utilization data; prerequisite for in-place pod resize (1.35 feature) and all cluster cost optimization work.",
      risk: "221 containers with no memory limit are a latent OOM and scheduling-eviction risk. VPA recommendation mode adds observability with no production impact.",
      ai_fit: "AI can interpret VPA recommendation outputs and draft updated resource manifests for review.",
      cost: "Right-sizing based on VPA data reduces overprovisioned memory reservations and CPU waste — the primary lever for cluster cost reduction.",
      dependency: "EKS 1.35 for in-place resize features. VPA is already installed — only recommendation mode needs enabling.",
      proof: "VPA recommendations visible for monitoring and app workloads; at least 10 containers updated with evidence-backed limits; no OOM increase observed.",
      effort: 2,
      scores: [55, 80, 60, 30, 75, 5],
    },
    {
      id: "cluster_optimization",
      name: "COST: Cluster Optimization — Reshape / Rightsize",
      category: "Cost / SRE",
      horizon: "next",
      summary: "devtest and production clusters are memory-hot / CPU-cold. Nodes run 45–68% memory but only 3–15% CPU. ~72 vCPU used across dozens of multi-vCPU nodes. Reconfigure CastAI to prefer R-family (memory-optimized) instances for non-CI shared pool and right-size workloads with VPA data. prd-internal is CPU-intensive — schedule separately.",
      customer_value: "Directly reduces infrastructure bill for all teams using shared cluster resources. Correct node shapes improve scheduling efficiency and bin-packing.",
      leverage: "Establishes separate memory-intensive and CPU-intensive workload groups and node pools as a reusable scheduling pattern for future workloads.",
      risk: "Reduces CPU over-provisioning waste and improves bin-packing efficiency. Wrong node shapes inflate costs without improving reliability.",
      ai_fit: "AI can analyze VPA recommendations and suggest updated resource manifests and CastAI template configurations.",
      cost: "R-family instances for memory-heavy workloads and right-sizing 72+ vCPU of wasted compute is the highest-value cost action in the cluster.",
      dependency: "VPA recommendation mode enabled (requires EKS 1.35). CastAI node template access. prd-internal workload CPU profile documentation.",
      proof: "Node-level CPU:memory ratio measurably improved; monthly cluster cost reduced; prd-internal workloads on separate CPU-optimized pool; CastAI template updated.",
      effort: 4,
      scores: [45, 65, 35, 25, 90, 5],
    },
    {
      id: "cert_manager_upgrade",
      name: "Cert-manager 1.10 → 1.20 (near EOL)",
      category: "SRE / Security",
      horizon: "now",
      summary: "cert-manager 1.10.1 is nine minor versions behind latest (1.20.1, March 2026). Only 1.19 and 1.20 are supported — everything ≤1.18 is EOL with no security updates. It manages 160 certificates via a failurePolicy:Fail webhook, making it a single point of failure for all certificate issuance. Rehearse in sre-test; take CRD backups first.",
      customer_value: "Protects 160 certificates from unpatched CVEs and ensures the failurePolicy:Fail webhook does not become an outage vector for all certificate-dependent workloads.",
      leverage: "1.20 adds Gateway API support. Sequential upgrade rehearsal in sre-test becomes a reusable playbook for future cert-manager upgrades.",
      risk: "EOL cert-manager with a failurePolicy:Fail webhook is a single point of failure for 160 certificates and an active compliance exposure. Nine minor versions of unpatched CVEs.",
      ai_fit: "AI can draft upgrade path steps and diff CRD schemas between 1.10 and 1.20 to identify breaking changes.",
      cost: "No ongoing cost change; avoids potential outage cost from an unpatched webhook failure or certificate expiry cascade.",
      dependency: "CRD backup before upgrade. sre-test rehearsal run through the documented upgrade path. Coordination with certificate consumers.",
      proof: "cert-manager 1.20.1 deployed in production; all 160 certificates healthy; sre-test upgrade rehearsed and documented.",
      effort: 4,
      scores: [50, 55, 10, 90, 25, 97],
    },
    {
      id: "cilium_upgrade",
      name: "Cilium Upgrade 1.16 → 1.19",
      category: "SRE / Security",
      horizon: "next",
      summary: "Cluster runs Cilium 1.16.10; current stable is 1.19 (Feb 2026). 1.16 is at/near end-of-support (3 stable branches maintained). Stepwise upgrade 1.16→1.17→1.18→1.19 (sequential minors required). Unlocks WireGuard strict mode, ztunnel-based transparent encryption + sidecar-less mutual auth, multi-level DNS wildcard policy. CNI upgrades are the riskiest change class.",
      customer_value: "Encrypted inter-node traffic (WireGuard strict mode) and sidecar-less mTLS improve security posture for all cluster workloads without sidecar overhead.",
      leverage: "WireGuard strict mode and ztunnel transparent encryption reduce future mTLS implementation effort and enable default-deny local-cluster-only policy semantics.",
      risk: "EOL CNI is the highest-risk unpatched component in the cluster. Each sequential minor upgrade requires rehearsal in sre-test — CNI upgrades are the riskiest change class in this list.",
      ai_fit: "AI can draft per-step upgrade checklists and validate Cilium network policy syntax changes across versions.",
      cost: "No direct cost reduction; avoids potential CNI-related incident cost from running an EOL networking stack.",
      dependency: "Rehearse in sre-test before each production step. Each sequential minor must be stable before proceeding. CNI upgrade requires careful traffic and policy validation.",
      proof: "Cilium 1.19 running in all clusters; WireGuard strict mode enabled; no network policy regressions in sre-test rehearsal; all workloads healthy post-upgrade.",
      effort: 5,
      scores: [40, 70, 30, 75, 25, 96],
    },
    {
      id: "external_dns_migration",
      name: "Migrate External-DNS to kubernetes-sigs Chart",
      category: "SRE / Supply Chain",
      horizon: "now",
      summary: "external-dns runs from bitnami-pre-2022/external-dns, a frozen pre-2022 chart line. Bitnami's public catalog is discontinued — a supply-chain dead end with no security updates or new features. Migrate to kubernetes-sigs/external-dns chart.",
      customer_value: "Restores a supported, maintained chart supply chain for external-dns, which manages all cluster DNS records for every deployed service.",
      leverage: "Moves to the canonical kubernetes-sigs/external-dns chart, keeping DNS management on an active upgrade path for future feature adoption.",
      risk: "Running from a discontinued chart line means no CVE patches and no fixes. A dead-end supply chain is an audit finding and an unpatched attack surface.",
      ai_fit: "AI can diff the bitnami and kubernetes-sigs chart values schemas to generate a migration values mapping.",
      cost: "No cost change; eliminates the support overhead of maintaining a dead-end chart dependency.",
      dependency: "Values schema migration mapping from bitnami to kubernetes-sigs chart format. DNS record validation after cutover.",
      proof: "external-dns running from kubernetes-sigs/external-dns chart; all DNS records reconciling correctly; bitnami chart removed from cluster.",
      effort: 2,
      scores: [35, 50, 10, 60, 25, 72],
    },
    {
      id: "storage_class_gp3",
      name: "COST/Perf: Migrate Default Storage Class GP2 → CSI GP3",
      category: "Cost / SRE",
      horizon: "now",
      summary: "Default StorageClass is gp2 using the deprecated in-tree driver. CSI GP3 classes exist but none are default. Current distribution: 40 volumes on eks-ssd, 17 on gp2, 35 on ebs-gp3. GP3 provides ~20% lower cost, independent IOPS/throughput tuning, and more consistent performance especially for smaller volumes.",
      customer_value: "All new PVCs get cheaper, better-performing GP3 storage automatically. Smaller volumes no longer need to be oversized to hit IOPS targets.",
      leverage: "Removes reliance on deprecated in-tree Kubernetes storage driver; sets foundation for future storage optimization and CSI feature adoption.",
      risk: "In-tree storage drivers are deprecated and will eventually be removed. Running legacy provisioner is an audit finding and creates migration debt.",
      ai_fit: "AI can generate migration manifests and PVC annotation updates for each of the 57 affected volumes.",
      cost: "~20% lower storage cost across all migrated volumes. GP3 decouples IOPS from volume size — direct cost savings for every smaller-than-3TB volume.",
      dependency: "Per-workload migration plan for 17 gp2 PVCs and 40 eks-ssd PVCs. Helm chart updates for charts referencing legacy StorageClasses.",
      proof: "CSI gp3 StorageClass is cluster default; all new PVCs use ebs.csi.aws.com; legacy in-tree StorageClasses retired; zero new PVCs provisioned on gp2.",
      effort: 3,
      scores: [55, 60, 35, 40, 85, 20],
    },
    {
      id: "helm_secret_bloat",
      name: "Helm Release Secret Bloat — ETCd Performance",
      category: "SRE / Performance",
      horizon: "now",
      summary: "1,775 helm.sh/release.v1 secrets across namespaces bloat ETCd and slow LIST/watch and API calls cluster-wide. ai-kontrol has 231 revisions from a suspected redeploy loop. Set --history-max 5-10, prune old secrets, and investigate the ai-kontrol loop root cause.",
      customer_value: "Faster API server LIST/watch and reduced backup sizes improve all cluster tooling and reduce etcd-induced API latency for all teams.",
      leverage: "Pruning ETCd bloat and fixing the ai-kontrol loop creates a maintainable Helm baseline. --history-max enforcement prevents recurrence.",
      risk: "1,775 secrets increase API latency cluster-wide and inflate etcd backup size. The 231-revision ai-kontrol loop is an active reliability smell that must be root-caused before pruning.",
      ai_fit: "AI can generate kubectl cleanup scripts and analyze Helm release history to diagnose the ai-kontrol redeploy loop pattern.",
      cost: "Smaller etcd means cheaper backups and reduced etcd storage. Fixing the redeploy loop eliminates wasted compute from 231+ spurious deployments.",
      dependency: "Investigate ai-kontrol 231-revision loop root cause before bulk pruning. Codefresh --history-max configuration access.",
      proof: "Helm release secret count below 200 total; --history-max enforced in Helm and Codefresh config; ai-kontrol loop root cause identified and resolved; ETCd size measurably reduced.",
      effort: 2,
      scores: [50, 55, 10, 60, 55, 12],
    },
    {
      id: "graviton4_investigation",
      name: "COST: Investigate Graviton4 Migration (Graviton2 → Graviton4)",
      category: "Cost / SRE",
      horizon: "next",
      summary: "Current pool uses r6g/x2gd/m6g (Graviton2, 2020). r8g/m8g are GA in us-east-1 with +34% price-performance vs Graviton2 and 2× EBS bandwidth (directly helps Prometheus WAL and Thanos compact). x2gd has no Gen4 successor — evaluate r8gd per workload. Update CastAI template to prefer 8g families and let natural rotation migrate (no workload changes; already ARM).",
      customer_value: "34% price-performance improvement on all Graviton compute — direct infrastructure cost reduction with no workload changes required.",
      leverage: "CastAI template TF update enables natural node rotation to Graviton4 with zero workload migration effort (already ARM-compatible).",
      risk: "x2gd has no Gen4 successor; per-workload evaluation needed to avoid stranded migration paths. Risk is low — no architecture changes required.",
      ai_fit: "AI can analyze workload memory/EBS bandwidth profiles and recommend instance family mapping from Graviton2 to Graviton4.",
      cost: "+34% price-performance and 2× EBS bandwidth for Prometheus/Thanos WAL. Natural rotation via CastAI means no migration downtime or extra cost.",
      dependency: "CastAI template and nodegroup TF access. Per-workload EBS bandwidth profile analysis for x2gd replacement candidates.",
      proof: "CastAI template updated to prefer r8g/m8g families; at least one node pool rotating to Graviton4 with verified price-performance improvement documented.",
      effort: 2,
      scores: [30, 55, 30, 25, 85, 5],
    },
    {
      id: "database_credentials",
      name: "Database Rolling Credentials (30-day rotation)",
      category: "SRE / Security",
      horizon: "now",
      summary: "Database credentials need automated rolling rotation every 30 days (or 2 weeks). Lead the coordination across all service teams to ensure the rotation mechanism is operational and services consume rotated credentials without manual intervention.",
      customer_value: "Protects customer data by ensuring compromised credentials have a bounded TTL — directly required for HIPAA/SOC2 compliance.",
      leverage: "Establishes a reusable automated credential rotation pattern applicable to other secrets (API keys, signing secrets) beyond database credentials.",
      risk: "Static long-lived credentials are a critical HIPAA/SOC2 compliance gap. Automated rotation reduces breach blast radius and closes an active audit finding.",
      ai_fit: "AI can draft the rotation runbook and identify service consumers that need credential update hooks reviewed.",
      cost: "No direct cost change; avoids potential breach incident cost and compliance fine from unrotated credentials.",
      dependency: "Service inventory of all database credential consumers. Coordination with all service owners. Secrets Manager or equivalent rotation infrastructure.",
      proof: "Automated credential rotation running on 30-day schedule; all service teams confirmed consuming rotated credentials without manual intervention; rotation tested via simulated rotation event.",
      effort: 3,
      scores: [50, 55, 10, 75, 25, 96],
    },
    {
      id: "supply_chain",
      name: "Supply Chain Security — AI Build Process (everyone-ai)",
      category: "SRE / Security",
      horizon: "next",
      summary: "Establish a secure, verifiable build process for AI-related components (everyone-ai) so that artifacts are signed, provenance is tracked, and the supply chain from source to deployment is auditable and enforced via Artifactory-only policy.",
      customer_value: "Prevents supply-chain compromise of AI tooling used by all engineering teams — a direct dependency for safe AI program expansion.",
      leverage: "Signed artifact build process applies to all future AI component releases. Artifactory policy enforcement prevents the pattern from drifting without review.",
      risk: "Unsigned, unverifiable AI component builds are an audit finding and a real supply-chain compromise vector. HIPAA/SOC2 scope includes AI tooling.",
      ai_fit: "AI can draft SBOM generation steps and policy-as-code for artifact signing checks in CI.",
      cost: "Low ongoing cost for signing infrastructure. Avoids much larger incident and compliance cost of a supply-chain compromise.",
      dependency: "Artifactory-only enforcement policy. CI pipeline signing integration. Artifact signing key management.",
      proof: "AI component builds produce signed artifacts with traceable provenance; at least one Artifactory-enforced policy blocking unsigned images is active.",
      effort: 3,
      scores: [50, 70, 35, 55, 25, 93],
    },
    {
      id: "gli_k8s_storage",
      name: "GLI: Isolated K8s Ephemeral Workload Storage Architecture",
      category: "SRE / AI Platform",
      horizon: "now",
      summary: "Settle the storage architecture for long-running K8s pod workloads (>8h, Capsule use cases, Temporal agents). S3/S3 Files for immutable bootstrap; EFS (RWX) for writable pod workspace. Add EFS lifecycle handling to prevent orphaned volumes (silent cost leak + audit finding). S3 Files went GA April 2026 but has no production K8s CSI driver yet — EFS stays the right choice for pod volumes.",
      customer_value: "Provides the correct, documented storage primitives on which Capsule, Temporal agents, and Claude Code pod workloads depend.",
      leverage: "Bootstrap→link→compress→push (S3) runbook and EFS/S3 decision framework become the reference pattern for all pod-based agent workloads.",
      risk: "Orphaned EFS volumes are a recurring audit finding and a silent ongoing cost leak. Wrong storage choice (S3 for write-heavy or EFS for immutable data) forces expensive rework.",
      ai_fit: "AI can validate I/O profile assumptions against S3/EFS characteristics and generate EFS mount lifecycle hook templates.",
      cost: "Clean EFS teardown prevents orphaned volume cost accumulation. S3 Files spike could eliminate custom gzip/push glue on the EC2/launcher side.",
      dependency: "S3 Files production K8s CSI driver availability check. Coordination with MicroVM and Temporal agent teams on shared primitives.",
      proof: "Runbook documented and published; EFS mounts tear down cleanly in test (10 pod lifecycle runs, zero orphaned volumes); S3 Files spike completed.",
      effort: 4,
      scores: [65, 85, 90, 70, 55, 38],
    },
    {
      id: "lambda_microvm_sandbox",
      name: "Lambda MicroVM Sandbox for AI Agents (Firecracker)",
      category: "SRE / AI Platform",
      horizon: "now",
      summary: "Deploy Firecracker-based Lambda MicroVM sandbox to keep AI agent tool-execution inside a Capsule-controlled, VPC-restricted, hardware-isolated boundary instead of Anthropic-managed infrastructure. Sprint A: CloudFormation stack, org key in Secrets Manager only, clean session launch→tool-calls→terminate. Sprint B: default-deny egress + allowlist, WAF, signing-secret rotation, idle/duration reaping. Add Firecracker patch cadence as a named SRE control.",
      customer_value: "Every Claude Code agent action runs in an isolated, VPC-restricted MicroVM. The permission structure for the entire AI program depends on this control being in place.",
      leverage: "MicroVM isolation is the control plane for the AI program. Cost dashboard, agent scaling, and every downstream agent deployment rest on this boundary.",
      risk: "Without MicroVM isolation, agent tool-calls run in uncontrolled compute. 2026 saw the first two Firecracker hypervisor-escape CVEs — patch cadence must be a named SRE control.",
      ai_fit: "AI can draft the CloudFormation stack template and IAM boundary policy for review; humans own the security boundary verification and Sprint B hardening.",
      cost: "Cost dashboard (AWS Thursday meeting) is built on MicroVM CloudWatch metrics. Controlled execution prevents runaway agent compute spend.",
      dependency: "(a) Does MicroVM need private-resource access in POC (determines VPC egress connector timing). (b) AI-account IAM boundary vs. new cross-account role. Resolve both before Sprint A commit.",
      proof: "Sprint A: clean session launch→tool-calls→terminate verified; org key confirmed never landing on compute. Sprint B: default-deny egress validated; WAF and rotation active.",
      effort: 5,
      scores: [80, 95, 98, 90, 65, 98],
    },
    {
      id: "igor_ebs_s3",
      name: "Igor: Mountable EBS (Temporal/Write-Heavy) + S3 Files (World Model/Read-Heavy)",
      category: "SRE / AI Platform",
      horizon: "now",
      summary: "Two storage primitives for Igor workloads: (1) Mountable EBS from Temporal for write-heavy use cases (MicroVM, agent state storage — things that need to store data). (2) S3 Files from a Pod specifically for the World Model — read-heavy, few writes, good fit for agents running on Temporal. Correct storage choice prevents expensive rework.",
      customer_value: "Provides the right storage primitive for each Igor workload: write-heavy EBS avoids S3 PUT cost spikes; read-heavy S3 avoids EBS overprovisioning.",
      leverage: "EBS/S3 split decision becomes the canonical reference pattern for all future agent storage architecture choices.",
      risk: "Using wrong storage (S3 for write-heavy WAL, EBS for read-heavy World Model) causes performance failures or cost spikes that force expensive rework.",
      ai_fit: "AI can validate I/O profile assumptions and draft the EBS mount and S3 access pattern documentation for each workload type.",
      cost: "S3 Files for read-heavy World Model is more cost-efficient than EBS for the same data. EBS for write-heavy avoids S3 PUT cost spikes from frequent small writes.",
      dependency: "EBS CSI driver for Temporal pod mounts. S3 Files access from pod (check CSI driver GA status). Igor team workload I/O profile confirmation.",
      proof: "EBS volumes mounted successfully from Temporal pods for write-heavy workloads; S3 Files access working from World Model pods; I/O profiles validated against assumptions.",
      effort: 2,
      scores: [65, 70, 75, 65, 65, 15],
    },
    {
      id: "cost_dashboard",
      name: "Cost Dashboard for AWS Thursday Meeting (MicroVM metrics)",
      category: "SRE / AI Platform",
      horizon: "next",
      summary: "Build a Grafana panel off CloudWatch metrics showing session count, boot latency, and running-MicroVM count. Running-MicroVM-count-not-trending-to-zero is the headline metric — it is both the cost-leak and orphaned-workload signal. Politically valuable: shows AI program is cost-controlled before leadership approves more spend.",
      customer_value: "Gives leadership a glanceable cost-control view, making the case for more AI program spend by proving existing spend is bounded and visible.",
      leverage: "Establishes the MicroVM observability baseline for all future agent scaling decisions and cost attribution.",
      risk: "Without visible cost signals, runaway MicroVM sessions are invisible until the AWS bill arrives. A Grafana panel beside SRE dashboards is cheaper than a separate Cost Explorer view.",
      ai_fit: "AI can draft Grafana panel JSON from the CloudWatch metric schema once MicroVM emits metrics.",
      cost: "Grafana/CloudWatch panel is cheaper than Cost Explorer. Makes MicroVM session cost attributable on demand, enabling leadership to approve spend confidently.",
      dependency: "MicroVM sandbox deployed and emitting CloudWatch metrics (Lambda MicroVM ticket is a hard prerequisite — cannot be built meaningfully before that).",
      proof: "Grafana panel live beside SRE dashboards; running-MicroVM-count displayed in the Thursday AWS meeting; no orphaned sessions visible.",
      effort: 2,
      scores: [70, 55, 50, 55, 70, 5],
    },
    {
      id: "observability_egress",
      name: "Observability: Pod-Level Egress Attribution (HIPAA/SOC2)",
      category: "SRE / Security",
      horizon: "next",
      summary: "VPC flow logs give no pod-level granularity. Deploy eBPF layer (Cilium/Hubble or CNI-agnostic Retina) in chaining mode for pod-identity-level L3-L7 visibility. Add NAT gateway logging and flow-log enrichment. Bet on Beyla/OTel (now the standardizing OpenTelemetry path) for auto-instrumented traces. Plan kernel 6.1+ (AL2023 or Bottlerocket AMIs); budget ~30% CPU overhead under load.",
      customer_value: "Provides the evidence trail required to scope a potential HIPAA/SOC2 breach: what left, from which pod, at what time — the difference between a scoped incident and an unscoped breach investigation.",
      leverage: "eBPF observability layer feeds future triage agent, RCA automation, and compliance reporting. Hubble/Retina become shared infrastructure for all egress attribution needs.",
      risk: "Without pod-level egress attribution, any network incident is an unscoped breach investigation. HIPAA and SOC2 require demonstrable egress evidence. Kernel 6.1+ required — plan AMI migration.",
      ai_fit: "AI can interpret Hubble/Retina flow logs and surface anomalies as structured output for triage agents.",
      cost: "~30% CPU overhead under load is the main cost. NAT gateway logging adds minor data egress cost. Justified by HIPAA breach scoping requirements.",
      dependency: "Kernel 6.1+ on AL2023 or Bottlerocket AMIs. Cilium 1.19 for Hubble integration (Cilium upgrade ticket is a dependency). CNI chaining mode validation.",
      proof: "Pod-identity-level egress logs visible in Grafana; a test pod's outbound traffic correctly attributed by namespace/pod; NAT gateway flow-log enrichment active and validated.",
      effort: 5,
      scores: [55, 70, 55, 55, 25, 93],
    },
    {
      id: "capsule_helm_hygiene",
      name: "Capsule Release Chart + Helm + Terraform Hygiene",
      category: "SRE / Compliance",
      horizon: "later",
      summary: "Document the wildcard exception and TF auto-upgrade exception with owner, compensating control, and hard expiry/review date. Codify linter rules as policy-as-code enforced in CI. Write up the Helm / release-chart change process. Low urgency, self-contained, no external dependency — pick up in any spare cycle.",
      customer_value: "Reduces audit exposure from two standing undocumented exceptions. Linter-in-CI prevents future chart drift without human review overhead.",
      leverage: "Policy-as-code linter enforced in CI prevents future exception accumulation. Change process documentation reduces onboarding time for new SREs.",
      risk: "Two undocumented standing exceptions are active audit findings. CI linter prevents regressions and is the compensating control for the wildcard exception.",
      ai_fit: "AI can draft the exception documentation templates and generate initial linter rule definitions from existing chart constraints.",
      cost: "Low effort, no new infrastructure cost. Avoids future audit remediation cost from undocumented exceptions.",
      dependency: "Exception owners available for documentation review. CI pipeline linter integration slot in sprint planning.",
      proof: "Both exceptions documented with owner, compensating control, and expiry date; linter enforced in CI; Helm change process published and linked from AGENTS.md.",
      effort: 2,
      scores: [30, 40, 10, 15, 25, 45],
    },
    {
      id: "k8s_mcp_layer",
      name: "Agent-Queryable K8s Data Layer (MCP) — DEVOPS-4733",
      category: "SRE / AI Platform",
      horizon: "now",
      summary: "The existing k8s-deploy-monitor skill is human-oriented (manual cia login, prose output, invoked by reading a file). Stand up a read-only MCP server wrapping getPodStatus, getPodLogs, getPodDescribe, getRecentDeploy, resolveNamespace with machine auth (scoped service account), structured JSON output, least-privilege RBAC, and basic audit logging.",
      customer_value: "Enables the triage/RCA agent, K8s-data-to-Jira agent, and all future K8s automation to query cluster state without manual CLI intervention.",
      leverage: "Dependency for the triage/RCA agent (DEVOPS-4734) and observability actions (SRE-332). Reusable across all SRE agent workflows — the shared data layer for agent-based ops.",
      risk: "Without structured K8s data access, agents must resort to ad hoc CLI or human-mediated lookups. Audit logging (caller, action, namespace, timestamp) is required for SOC2.",
      ai_fit: "Core AI infrastructure — the MCP server is the structured interface all K8s-aware agents use to query cluster state.",
      cost: "Read-only scoped service account; minimal compute cost. Removes the per-incident cost of manual triage intervention for every agent-assisted diagnostic.",
      dependency: "Scoped service account or assumed role setup. Audit logging infrastructure. Existing k8s-deploy-monitor skill as the data source reference implementation.",
      proof: "MCP server returns structured JSON for all five actions; machine auth working with no interactive cia login; audit log entries confirmed for caller, action, namespace, and timestamp.",
      effort: 3,
      scores: [65, 88, 90, 70, 35, 58],
    },
    {
      id: "agent_triage_rca",
      name: "Agent-Assisted On-Call Triage / RCA — DEVOPS-4734",
      category: "SRE / AI Platform",
      horizon: "next",
      summary: "Triage and RCA are redone from scratch each incident; post-mortems lag. Orchestrate existing triage skills (row-level-rca, triage-workflow-failures, diagnose-temporal-workflow) against live signals (Codefresh, Grafana/CloudWatch) via MCP. Given an incident reference, collect timeline, impacted services, suspected root cause, and evidence links. Emit a structured post-mortem skeleton as Markdown. Human-in-the-loop only — agent drafts, does not remediate.",
      customer_value: "Faster, consistent first-pass RCA for every incident reduces MTTR and on-call toil for all engineering teams relying on shared infrastructure.",
      leverage: "Establishes the triage orchestration pattern reusable for Sherlock, future RCA agents, and the K8s-data-to-Jira agent. Skills become composable agent primitives.",
      risk: "Structured first-pass RCA reduces the risk of incomplete post-mortems and missed action items. Human-in-the-loop constraint ensures agent never remediates without approval.",
      ai_fit: "High AI fit: agent orchestrates existing skills, collects evidence from live signals, and drafts post-mortem skeleton. Human reviews and acts on draft.",
      cost: "Reduces on-call engineer hours spent on manual triage per incident. Post-mortem lag has reputational and compliance cost.",
      dependency: "K8s MCP data layer (DEVOPS-4733) for live K8s signals. Codefresh and Grafana/CloudWatch MCP access. Existing triage skills as the orchestration primitives.",
      proof: "Draft post-mortem for the SRE-334 rollback incident generated from agent; structure matches timeline, root cause, and action items validated by the incident owner.",
      effort: 3,
      scores: [70, 85, 80, 50, 45, 22],
    },
    {
      id: "sre_336_sandboxing",
      name: "SRE-336: Improve Agent Container Sandboxing (due 2026-07-31)",
      category: "SRE / AI Platform",
      horizon: "now",
      summary: "Agent container sandboxing has ballooned to span three scopes: new AWS Lambda container (late June), K8s containers, and WAF ACL sandboxing. Being rewritten for the new increment. Due 2026-07-31.",
      customer_value: "Ensures all AI agent code runs inside defined, auditable sandboxes across Lambda, K8s, and WAF — prerequisite for any production agent deployment approval.",
      leverage: "Unified sandboxing model across all three execution environments reduces future security surface and security review overhead per new agent deployment.",
      risk: "Without consistent sandboxing, agent containers have undefined blast radius. WAF ACL sandboxing is a named security control for the AI program. Due 2026-07-31.",
      ai_fit: "AI can draft WAF ACL rules and K8s security context configurations for SRE review.",
      cost: "WAF ACL processing adds minor cost. Reduces incident cost from uncontrolled agent execution significantly.",
      dependency: "Lambda MicroVM sandbox work for Lambda container scoping. K8s security context standards. WAF ACL configuration access.",
      proof: "Agent containers pass security review across all three scopes (Lambda, K8s, WAF); sandboxing controls documented as named SRE controls before 2026-07-31.",
      effort: 3,
      scores: [70, 85, 80, 95, 45, 98],
    },
    {
      id: "sre_334_google_account",
      name: "SRE-334: Google Account & Key Management (due 2026-07-31, caused outage)",
      category: "SRE / Security",
      horizon: "now",
      summary: "Google account and key management change caused a production outage, was rolled back, and has a post-mortem pending. Due slipped to 2026-07-31. Requires safe re-implementation and post-mortem completion to close the incident loop.",
      customer_value: "Restores reliable Google account/key management after the outage; post-mortem closes the incident loop and provides evidence for affected teams and auditors.",
      leverage: "Post-mortem findings produce safer patterns for future key management changes across the organization — reusable as a key rotation playbook.",
      risk: "Previously caused a production outage. Re-implementation carries rollback risk. Post-mortem is required for SOC2 evidence of incident closure. Due 2026-07-31.",
      ai_fit: "AI can draft the post-mortem structure and suggest safer key rotation patterns and rollback tests for SRE review.",
      cost: "No direct cost change; avoids repeat outage cost and compliance finding from incomplete post-mortem.",
      dependency: "Post-mortem completion by due date. Safe re-implementation plan reviewed by SRE and security before any production change.",
      proof: "Post-mortem published and linked in incident tracker; Google account/key management re-implemented and verified; no recurrence in 2-week observation window.",
      effort: 2,
      scores: [55, 35, 10, 95, 25, 82],
    },
    {
      id: "sre_332_observability_actions",
      name: "SRE-332: Expose Observability Signals as Agent-Queryable Actions (due 2026-08-07)",
      category: "SRE / AI Platform",
      horizon: "now",
      summary: "Brian is building an agent that turns K8s data into Jira tickets. Expose K8s observability signals as structured, agent-callable actions so the agent can diagnose→act→observe→iterate without human mediation. Due slipped to 2026-08-07.",
      customer_value: "Enables Brian's K8s-data-to-Jira agent to generate structured tickets from live cluster signals, reducing the manual effort of translating cluster state into actionable tickets.",
      leverage: "Observability actions are a shared dependency for the triage agent, RCA agent, and all future K8s automation. Due 2026-08-07.",
      risk: "Without structured observability actions, agents fall back to ad hoc queries and produce inconsistent output that cannot be reliably acted upon.",
      ai_fit: "Core AI infrastructure — these actions are the structured inputs all K8s-aware agents consume for diagnosis and reporting.",
      cost: "Minimal; reuses existing monitoring data. Eliminates the manual translation cost from K8s state to Jira tickets per incident.",
      dependency: "K8s MCP data layer (DEVOPS-4733). Jira API integration. Brian's agent architecture and data schema requirements.",
      proof: "K8s observability actions return structured JSON; Brian's agent creates at least one valid, actionable Jira ticket from live cluster data before 2026-08-07.",
      effort: 3,
      scores: [65, 85, 90, 88, 30, 58],
    },
    {
      id: "sre_312_nginx",
      name: "SRE-312: STAGING Part 2, nginx Migration Campaign (pending PRs)",
      category: "SRE / Infrastructure",
      horizon: "next",
      summary: "nginx migration campaign for STAGING Part 2 has pending PR approvals. Unblock the review pipeline to complete the migration and remove the dual-config maintenance burden.",
      customer_value: "Completes the nginx migration for staging environments, unblocking teams that depend on staging for integration testing and release validation.",
      leverage: "Completing the migration removes the dual-config maintenance burden of running both old and new nginx configuration in parallel.",
      risk: "Stalled migrations increase config drift between environments. Pending PRs represent accumulated review debt.",
      ai_fit: "AI can review nginx config diffs for correctness and flag potential routing regressions before PR approval.",
      cost: "No direct cost change; removes the maintenance overhead of dual-config nginx management after migration completes.",
      dependency: "PR reviewer availability and staging environment validation slot after each merge.",
      proof: "All pending PRs merged; nginx migration complete in staging; no config drift from the production nginx pattern.",
      effort: 2,
      scores: [50, 45, 10, 35, 25, 18],
    },
  ];

  names.forEach((name) => {
    const principle = principles[name];
    principle.scoredPrompt = principle.prompt;
    principle.provenance = { kind: "seed" };
    principle.error = "";
    principle.running = false;
  });
  initiatives.forEach((item) => { item.scoreReasons = {}; item.seedScores = [...item.scores]; item.overrides = {}; item.seedEffort = item.effort; item.effortOverridden = false; });

  const inputs = names.map((name) => document.querySelector(`[data-weight="${name}"]`));
  let selected = initiatives[0].id;
  let activePrinciple = "";
  let statuses = {};
  let notes = {};
  let scenarios = [];
  const noteTimers = {};

  const validScores = (scores) => Array.isArray(scores)
    && scores.length === names.length
    && scores.every((value) => Number.isInteger(value) && value >= 0 && value <= 100);

  const loadWorkspace = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_SCHEMA) || "null");
      if (!saved || saved.schema !== STORE_SCHEMA) return;
      names.forEach((name, index) => {
        const row = saved.principles && saved.principles[name];
        if (row && typeof row.prompt === "string" && row.prompt.trim().length >= 10) {
          principles[name].prompt = row.prompt.trim();
          principles[name].scoredPrompt = typeof row.scoredPrompt === "string" ? row.scoredPrompt : "";
          principles[name].provenance = row.provenance && typeof row.provenance === "object" ? row.provenance : { kind: "seed" };
        }
        const weight = saved.weights && Number(saved.weights[index]);
        if (Number.isFinite(weight) && weight >= 0.1 && weight <= 99.6) inputs[index].value = String(weight);
      });
      const total = inputs.reduce((sum, input) => sum + Number(input.value), 0);
      if (Math.abs(total - 100) > 0.001) presets.balanced.forEach((value, index) => { inputs[index].value = String(value); });
      initiatives.forEach((item) => {
        const scores = saved.scores && saved.scores[item.id];
        const reasons = saved.reasons && saved.reasons[item.id];
        if (validScores(scores)) item.scores = [...scores];
        if (reasons && typeof reasons === "object") {
          names.forEach((name) => {
            if (typeof reasons[name] === "string" && reasons[name].length <= 600) item.scoreReasons[name] = reasons[name];
          });
        }
      });
    } catch (_error) {
      localStorage.removeItem(STORE_SCHEMA);
    }
  };

  const persistWorkspace = () => {
    try {
      localStorage.setItem(STORE_SCHEMA, JSON.stringify({
        schema: STORE_SCHEMA,
        weights: inputs.map((input) => Number(input.value)),
        principles: Object.fromEntries(names.map((name) => [name, {
          prompt: principles[name].prompt,
          scoredPrompt: principles[name].scoredPrompt,
          provenance: principles[name].provenance,
        }])),
        scores: Object.fromEntries(initiatives.map((item) => [item.id, item.scores])),
        reasons: Object.fromEntries(initiatives.map((item) => [item.id, item.scoreReasons])),
      }));
    } catch (_error) {
      // Browser storage is optional; the current view remains authoritative.
    }
  };

  const loadSession = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_SCHEMA) || "null");
      if (!saved || saved.schema !== SESSION_SCHEMA) return;
      statuses = saved.statuses || {};
      notes = saved.notes || {};
      scenarios = Array.isArray(saved.scenarios) ? saved.scenarios : [];
      initiatives.forEach((item) => {
        const ov = saved.overrides && saved.overrides[item.id];
        if (ov && typeof ov === "object") {
          Object.entries(ov).forEach(([k, v]) => {
            const i = Number(k);
            if (i >= 0 && i < names.length && Number.isInteger(v) && v >= 0 && v <= 100) {
              item.scores[i] = v;
              item.overrides[i] = v;
            }
          });
        }
        const ef = saved.effortOverrides && saved.effortOverrides[item.id];
        if (Number.isInteger(ef) && ef >= 1 && ef <= 5) {
          item.effort = ef;
          item.effortOverridden = true;
        }
      });
    } catch (_e) { localStorage.removeItem(SESSION_SCHEMA); }
  };

  const persistSession = () => {
    try {
      localStorage.setItem(SESSION_SCHEMA, JSON.stringify({
        schema: SESSION_SCHEMA,
        statuses,
        notes,
        scenarios,
        overrides: Object.fromEntries(initiatives.map((item) => [item.id, item.overrides])),
        effortOverrides: Object.fromEntries(initiatives.filter((item) => item.effortOverridden).map((item) => [item.id, item.effort])),
      }));
    } catch (_e) {}
  };

  const weightedScore = (item) => {
    const weights = inputs.map((input) => Number(input.value));
    const sum = weights.reduce((total, value) => total + value, 0) || 1;
    const raw = item.scores.reduce((total, value, index) => total + value * weights[index], 0) / sum;
    return Math.max(0, raw - item.effort * 5);
  };

  const redistribute = (changed) => {
    const floor = 0.1;
    const changedIndex = inputs.indexOf(changed);
    const target = Math.max(floor, Math.min(100 - floor * (inputs.length - 1), Number(changed.value) || floor));
    const others = inputs
      .map((input, index) => ({ input, index, value: Number(input.value) || floor }))
      .filter((row) => row.index !== changedIndex);
    const available = 100 - target - floor * others.length;
    const discretionary = others.reduce((sum, row) => sum + Math.max(0, row.value - floor), 0);
    changed.value = String(target);
    others.forEach((row) => {
      const share = discretionary > 1e-9 ? Math.max(0, row.value - floor) / discretionary : 1 / others.length;
      row.input.value = String(floor + share * available);
    });
  };

  const weightLabel = (value) => {
    const number = Number(value) || 0;
    if (Math.abs(number - Math.round(number)) < 0.005) return String(Math.round(number));
    if (number < 1) return number.toFixed(2);
    return number.toFixed(1);
  };

  const principleStatus = (name) => {
    const principle = principles[name];
    const provenance = principle.provenance || {};
    if (principle.running) return { kind: "running", text: "Re-scoring complete queue..." };
    if (principle.error) return { kind: "error", text: principle.error };
    if (principle.prompt !== principle.scoredPrompt) return { kind: "stale", text: "Prompt changed - scores stale" };
    if (provenance.kind === "model") {
      const tokens = Number(provenance.total_tokens) || Number(provenance.input_tokens || 0) + Number(provenance.output_tokens || 0);
      const cache = provenance.cache_hit ? "cached" : "uncached";
      return { kind: "model", text: `${String(provenance.model || "model")} - ${tokens.toLocaleString()} tokens - ${cache} - cost unknown` };
    }
    return { kind: "seed", text: "Seed scores" };
  };

  const renderPrincipleStatuses = () => {
    names.forEach((name) => {
      const state = principleStatus(name);
      const row = document.querySelector(`[data-principle="${name}"]`);
      row.dataset.scoreStatus = state.kind;
      row.querySelector(".principle-status").textContent = state.text;
      row.querySelector(".rescore-principle").disabled = Boolean(principles[name].running);
    });
    if (activePrinciple) document.querySelector("#principle-prompt-meta").textContent = principleStatus(activePrinciple).text;
  };

  // Update rank badges without reordering the DOM
  const updateRankBadges = () => {
    const container = document.querySelector("#principle-controls");
    const ranked = names
      .map((name, index) => ({ name, index, value: Number(inputs[index].value) }))
      .sort((a, b) => b.value - a.value || a.index - b.index);
    ranked.forEach((item, index) => {
      const rank = index + 1;
      const row = container.querySelector(`[data-principle="${item.name}"]`);
      const badge = row.querySelector(".principle-rank");
      row.dataset.rank = String(rank);
      badge.textContent = `#${rank}`;
      badge.setAttribute("aria-label", `Principle rank ${rank}`);
    });
  };

  // Actually reorder the DOM (only on explicit button click)
  const rankPrinciples = () => {
    const container = document.querySelector("#principle-controls");
    const ranked = names
      .map((name, index) => ({ name, index, value: Number(inputs[index].value) }))
      .sort((a, b) => b.value - a.value || a.index - b.index);
    ranked.forEach((item) => {
      const row = container.querySelector(`[data-principle="${item.name}"]`);
      container.appendChild(row);
    });
    updateRankBadges();
  };

  const cell = (text, className = "") => {
    const element = document.createElement("td");
    element.textContent = text;
    if (className) element.className = className;
    return element;
  };

  const OVERRIDE_COLORS = { red: "score-overridden", green: "score-override-green", yellow: "score-override-yellow", blue: "score-override-blue" };
  const overrideColorMap = {}; // id:index → color key

  const applyOverrideClass = (td, id, index) => {
    const key = `${id}:${index}`;
    const colorKey = overrideColorMap[key] || "red";
    td.className = OVERRIDE_COLORS[colorKey] || "score-overridden";
  };

  const scoreCell = (item, index) => {
    const td = document.createElement("td");
    const isOverridden = item.overrides[index] !== undefined;
    if (isOverridden) applyOverrideClass(td, item.id, index);
    td.textContent = String(item.scores[index]);
    td.title = "Double-click to override score";
    td.addEventListener("dblclick", (e) => {
      e.stopPropagation(); e.preventDefault();
      if (td.querySelector("input")) return;
      let committed = false;
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-direction:column;gap:5px;padding:2px 0;";
      const inp = document.createElement("input");
      inp.type = "number"; inp.min = "0"; inp.max = "100"; inp.step = "1";
      inp.value = String(item.scores[index]);
      inp.className = "score-inline-input";
      inp.style.cssText = "width:52px;height:24px;font-size:13px;";
      // Color picker strip
      const colors = document.createElement("div");
      colors.style.cssText = "display:flex;gap:4px;align-items:center;";
      // "no color" = clear the override entirely
      const noneBtn = document.createElement("button");
      noneBtn.type = "button";
      noneBtn.style.cssText = "width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(255,255,255,.35);background:transparent;cursor:pointer;padding:0;position:relative;";
      noneBtn.title = "clear";
      noneBtn.innerHTML = '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:rgba(255,255,255,.6);line-height:1;">×</span>';
      noneBtn.addEventListener("mousedown", (ev) => {
        // Use mousedown instead of click — fires before blur, avoids race
        ev.stopPropagation(); ev.preventDefault();
        committed = true;
        delete item.overrides[index];
        delete overrideColorMap[`${item.id}:${index}`];
        item.scores[index] = item.baseScores ? item.baseScores[index] : item.seedScores[index];
        // Immediately reset cell visuals
        td.className = "";
        td.textContent = String(item.scores[index]);
        persistSession();
        scheduleReorder();
      });
      colors.appendChild(noneBtn);
      [["red","#7f1d1d"],["green","#14532d"],["yellow","#713f12"],["blue","#1e3a5f"]].forEach(([key, bg]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.cssText = `width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(255,255,255,.25);background:${bg};cursor:pointer;padding:0;`;
        btn.title = key;
        btn.addEventListener("click", (ev) => { ev.stopPropagation(); overrideColorMap[`${item.id}:${index}`] = key; });
        colors.appendChild(btn);
      });
      wrap.append(inp, colors);
      td.textContent = "";
      td.appendChild(wrap);
      inp.focus(); inp.select();
      const commit = () => {
        if (committed) return;
        committed = true;
        const v = parseInt(inp.value, 10);
        if (!isNaN(v) && v >= 0 && v <= 100) {
          const rounded = Math.round(v);
          item.scores[index] = rounded;
          item.overrides[index] = rounded;
          if (!overrideColorMap[`${item.id}:${index}`]) overrideColorMap[`${item.id}:${index}`] = "red";
          persistSession();
          scheduleReorder();
        }
        renderQueue();
      };
      inp.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") inp.blur();
        if (ev.key === "Escape") { committed = true; renderQueue(); }
      });
      inp.addEventListener("blur", () => setTimeout(commit, 100)); // delay so color click registers
      inp.addEventListener("click", (ev) => ev.stopPropagation());
      wrap.addEventListener("click", (ev) => ev.stopPropagation());
    });
    return td;
  };

  const renderQueue = () => {
    const body = document.querySelector("#portfolio-body");
    body.replaceChildren();
    const ranked = [...initiatives].sort((a, b) => weightedScore(b) - weightedScore(a) || a.name.localeCompare(b.name));
    ranked.forEach((item, index) => {
      const row = document.createElement("tr");
      row.dataset.id = item.id;
      const hasNotes = notes[item.id] && notes[item.id].trim();
      row.className = (item.id === selected ? "selected " : "") + (hasNotes ? "has-notes" : "");
      row.appendChild(cell(String(index + 1), "rank"));

      // Initiative cell: title + note dot + category + status chip
      const identity = document.createElement("td");
      identity.className = "initiative";
      const title = document.createElement("b");
      title.textContent = item.name;
      if (notes[item.id] && notes[item.id].trim()) {
        const dot = document.createElement("span");
        dot.className = "note-dot";
        dot.title = notes[item.id];
        title.appendChild(dot);
      }
      const category = document.createElement("small");
      category.textContent = item.category;
      const status = statuses[item.id];
      if (status) {
        const chip = document.createElement("span");
        chip.className = `status-chip ${status}`;
        chip.textContent = STATUS_LABELS[status];
        category.appendChild(chip);
      }
      identity.append(title, category);
      row.appendChild(identity);

      row.appendChild(cell(item.horizon, `horizon ${item.horizon}`));
      item.scores.forEach((_, i) => row.appendChild(scoreCell(item, i)));

      // Editable effort cell (dblclick to edit)
      const effortTd = document.createElement("td");
      effortTd.className = item.effortOverridden ? "score-overridden" : "";
      effortTd.textContent = item.effort >= 5 ? "5*" : String(item.effort);
      effortTd.title = item.effort >= 5 ? "Double-click to edit. 5 = needs breakdown." : `Double-click to edit. ${item.effort} point${item.effort > 1 ? "s" : ""} of effort.`;
      effortTd.style.cssText = "cursor:pointer;font-variant-numeric:tabular-nums;";
      effortTd.addEventListener("dblclick", (e) => {
        e.stopPropagation(); e.preventDefault();
        if (effortTd.querySelector("select")) return;
        const sel = document.createElement("select");
        sel.style.cssText = "width:56px;background:var(--input-bg);color:var(--ink);border:1px solid var(--line);border-radius:3px;font:inherit;font-size:12px;padding:1px;";
        [1,2,3,4,5].forEach((v) => {
          const opt = document.createElement("option");
          opt.value = v; opt.textContent = v >= 5 ? "5 (split)" : `${v} pt${v > 1 ? "s" : ""}`;
          if (v === item.effort) opt.selected = true;
          sel.appendChild(opt);
        });
        effortTd.textContent = "";
        effortTd.appendChild(sel);
        sel.focus();
        const commit = () => {
          const v = parseInt(sel.value, 10);
          if (v >= 1 && v <= 5) {
            item.effort = v;
            item.effortOverridden = true;
            persistSession();
          }
          renderQueue();
          const selItem = initiatives.find((it) => it.id === selected);
          if (selItem) renderDetail(selItem);
        };
        sel.addEventListener("change", commit);
        sel.addEventListener("blur", commit);
        sel.addEventListener("click", (ev) => ev.stopPropagation());
      });
      row.appendChild(effortTd);

      row.appendChild(cell(weightedScore(item).toFixed(1), "score"));

      // Running total placeholder — filled after all rows built
      const runTd = document.createElement("td");
      runTd.className = "running-total";
      runTd.style.fontVariantNumeric = "tabular-nums";
      row.appendChild(runTd);

      row.addEventListener("click", () => {
        selected = item.id;
        // Update selection in-place without rebuilding DOM (preserves dblclick targets)
        body.querySelectorAll("tr").forEach((tr) => tr.classList.toggle("selected", tr.dataset.id === selected));
        renderDetail(item);
      });
      body.appendChild(row);
    });

    // Fill running totals (cumulative effort points, top to bottom)
    let cumulative = 0;
    ranked.forEach((item) => {
      const pts = item.effort >= 5 ? 0 : item.effort; // 5="needs breakdown" doesn't count
      cumulative += pts;
      const runCell = body.querySelector(`tr[data-id="${item.id}"] .running-total`);
      if (runCell) {
        runCell.textContent = cumulative > 0 ? String(cumulative) : "—";
        runCell.title = `${cumulative} cumulative effort points through rank ${Array.from(body.children).indexOf(runCell.parentElement) + 1}`;
      }
    });
  };

  const addDefinition = (list, termText, definitionText) => {
    const term = document.createElement("dt");
    const definition = document.createElement("dd");
    term.textContent = termText;
    definition.textContent = definitionText;
    list.append(term, definition);
  };

  const securityBand = (score) => {
    if (score >= 90) return { label: "CRITICAL", cls: "sec-critical" };
    if (score >= 70) return { label: "HIGH",     cls: "sec-high" };
    if (score >= 40) return { label: "MEDIUM",   cls: "sec-medium" };
    if (score >= 10) return { label: "LOW",       cls: "sec-low" };
    return                  { label: "NONE",      cls: "sec-none" };
  };

  const renderDetail = (item) => {
    const root = document.querySelector("#initiative-detail");
    root.replaceChildren();
    const main = document.createElement("div");
    main.className = "detail-main";
    const eyebrow = document.createElement("div");
    eyebrow.className = "label";
    eyebrow.textContent = `${item.category} / ${item.horizon}`;
    const title = document.createElement("h3");
    title.textContent = item.name;
    const summary = document.createElement("p");
    summary.textContent = item.summary;
    const list = document.createElement("dl");
    addDefinition(list, "Customer value", item.customer_value);
    addDefinition(list, "Leverage", item.leverage);
    addDefinition(list, "Risk", item.risk);
    addDefinition(list, "AI fit", item.ai_fit);
    addDefinition(list, "Cost", item.cost);
    main.append(eyebrow, title, summary, list);

    // Score breakdown
    const scoreGrid = document.createElement("div");
    scoreGrid.className = "detail-score-grid";
    const scoreGridLabel = document.createElement("div");
    scoreGridLabel.className = "label";
    scoreGridLabel.textContent = "Principle scores";
    scoreGrid.appendChild(scoreGridLabel);
    names.forEach((name, index) => {
      const cell = document.createElement("div");
      cell.className = "detail-score-cell";

      const pname = document.createElement("span");
      pname.className = "detail-score-name";
      pname.textContent = principles[name].name;

      // ── Stepper control ──────────────────────────────────────────────
      const stepper = document.createElement("div");
      const isOverridden = item.overrides[index] !== undefined;
      stepper.className = "score-stepper" + (isOverridden ? " overridden" : "");

      const btnDown = document.createElement("button");
      btnDown.type = "button";
      btnDown.className = "score-step-btn";
      btnDown.textContent = "−";
      btnDown.title = `Decrease ${principles[name].name} by 5`;
      btnDown.setAttribute("aria-label", `Decrease ${principles[name].name} score by 5`);

      const inp = document.createElement("input");
      inp.type = "number";
      inp.className = "score-inline-input";
      inp.min = "0"; inp.max = "100"; inp.step = "1";
      inp.value = String(item.scores[index]);
      inp.setAttribute("aria-label", `${principles[name].name} score`);

      const btnUp = document.createElement("button");
      btnUp.type = "button";
      btnUp.className = "score-step-btn";
      btnUp.textContent = "+";
      btnUp.title = `Increase ${principles[name].name} by 5`;
      btnUp.setAttribute("aria-label", `Increase ${principles[name].name} score by 5`);

      const applyScore = (v) => {
        const rounded = Math.min(100, Math.max(0, Math.round(v)));
        item.scores[index] = rounded;
        item.overrides[index] = rounded;
        persistWorkspace();
        persistSession();
        scheduleReorder();
        renderDetail(item); // re-render to refresh total + security badge + override highlight
      };

      btnDown.addEventListener("click", (e) => { e.stopPropagation(); applyScore(item.scores[index] - 5); });
      btnUp.addEventListener("click",   (e) => { e.stopPropagation(); applyScore(item.scores[index] + 5); });
      inp.addEventListener("change",    (e) => { e.stopPropagation(); const v = parseInt(inp.value, 10); if (!isNaN(v)) applyScore(v); });
      inp.addEventListener("click",     (e) => e.stopPropagation()); // don't trigger row select

      stepper.append(btnDown, inp, btnUp);

      if (name === "security") {
        const band = securityBand(item.scores[index]);
        const badge = document.createElement("span");
        badge.className = `detail-sec-badge ${band.cls}`;
        badge.textContent = band.label;
        cell.append(pname, stepper, badge);
      } else {
        cell.append(pname, stepper);
      }
      scoreGrid.appendChild(cell);
    });
    const totalRow = document.createElement("div");
    totalRow.className = "detail-score-cell detail-score-total";
    const totalLabel = document.createElement("span");
    totalLabel.className = "detail-score-name";
    totalLabel.textContent = `Weighted total (effort: ${item.effort >= 5 ? "needs breakdown" : item.effort + " pt" + (item.effort > 1 ? "s" : "")})`;
    const totalVal = document.createElement("span");
    totalVal.className = "detail-score-value";
    totalVal.textContent = weightedScore(item).toFixed(1);
    totalRow.append(totalLabel, totalVal);
    scoreGrid.appendChild(totalRow);
    main.appendChild(scoreGrid);

    const side = document.createElement("div");
    side.className = "detail-side";

    // ── Status picker ────────────────────────────────────────────────────
    const statusLabel = document.createElement("div");
    statusLabel.className = "label";
    statusLabel.textContent = "Team status";
    const picker = document.createElement("div");
    picker.className = "status-picker";
    [["blocked", "Blocked"], ["in-progress", "In Progress"], ["done", "Done"], ["deferred", "Deferred"]].forEach(([key, label]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `status-pick-btn ${key}${statuses[item.id] === key ? " active" : ""}`;
      btn.textContent = label;
      btn.addEventListener("click", () => {
        statuses[item.id] = statuses[item.id] === key ? "" : key;
        persistSession();
        renderQueue();
        renderDetail(item);
      });
      picker.appendChild(btn);
    });
    if (statuses[item.id]) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "status-pick-btn clear-status";
      clearBtn.textContent = "× Clear";
      clearBtn.addEventListener("click", () => { statuses[item.id] = ""; persistSession(); renderQueue(); renderDetail(item); });
      picker.appendChild(clearBtn);
    }
    side.append(statusLabel, picker);

    // ── Meeting notes ────────────────────────────────────────────────────
    const notesWrap = document.createElement("div");
    notesWrap.className = "session-notes-wrap";
    const notesLabel = document.createElement("label");
    notesLabel.className = "session-notes-label";
    notesLabel.textContent = "Meeting notes";
    const notesInput = document.createElement("textarea");
    notesInput.className = "session-notes-input";
    notesInput.placeholder = "Type notes for this item...";
    notesInput.value = notes[item.id] || "";
    notesInput.addEventListener("input", () => {
      notes[item.id] = notesInput.value;
      clearTimeout(noteTimers[item.id]);
      noteTimers[item.id] = setTimeout(() => { persistSession(); renderQueue(); }, 800);
    });
    notesInput.addEventListener("click", (e) => e.stopPropagation());
    notesWrap.append(notesLabel, notesInput);
    side.appendChild(notesWrap);

    const dependencyLabel = document.createElement("div");
    dependencyLabel.className = "label";
    dependencyLabel.textContent = "Dependency";
    const dependency = document.createElement("p");
    dependency.textContent = item.dependency;
    const proofLabel = document.createElement("div");
    proofLabel.className = "label";
    proofLabel.textContent = "Proof before promotion";
    const proof = document.createElement("p");
    proof.className = "proof";
    proof.textContent = item.proof;
    side.append(dependencyLabel, dependency, proofLabel, proof);

    const reasonNames = names.filter((name) => item.scoreReasons[name]);
    if (reasonNames.length) {
      const evidence = document.createElement("div");
      evidence.className = "score-evidence";
      const evidenceLabel = document.createElement("div");
      evidenceLabel.className = "label";
      evidenceLabel.textContent = "Re-score evidence";
      evidence.appendChild(evidenceLabel);
      reasonNames.forEach((name) => {
        const row = document.createElement("div");
        row.className = "score-evidence-row";
        const head = document.createElement("div");
        head.className = "score-evidence-head";
        const principle = document.createElement("span");
        const value = document.createElement("span");
        const reason = document.createElement("p");
        const status = principleStatus(name);
        principle.textContent = `${principles[name].name}${status.kind === "stale" ? " — stale" : ""}`;
        value.textContent = String(item.scores[names.indexOf(name)]);
        reason.className = "score-evidence-reason";
        reason.textContent = item.scoreReasons[name];
        const provenance = principles[name].provenance || {};
        if (provenance.result_hash) row.title = `Result ${provenance.result_hash}; request ${provenance.request_hash || "unavailable"}`;
        head.append(principle, value);
        row.append(head, reason);
        evidence.appendChild(row);
      });
      side.appendChild(evidence);
    }
    root.append(main, side);
  };

  // ── Deferred reorder (3-second debounce with countdown indicator) ──────
  const REORDER_DELAY = 3000;
  let reorderTimer = null;

  const getOrCreateIndicator = () => {
    let el = document.getElementById("reorder-indicator");
    if (!el) {
      el = document.createElement("div");
      el.id = "reorder-indicator";
      el.className = "reorder-indicator";
      el.hidden = true;
      const hdr = document.querySelector("#queue .panel-header-right");
      if (hdr) hdr.prepend(el);
    }
    return el;
  };

  const showCountdown = () => {
    const el = getOrCreateIndicator();
    el.hidden = false;
    let secs = REORDER_DELAY / 1000;
    const update = () => {
      el.innerHTML =
        `<svg class="reorder-clock-svg" viewBox="0 0 20 20" aria-hidden="true">` +
        `<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>` +
        `<line x1="10" y1="10" x2="10" y2="3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"` +
        ` style="transform-origin:10px 10px;transform:rotate(${(1 - secs / (REORDER_DELAY / 1000)) * 360}deg)"/>` +
        `<line x1="10" y1="10" x2="14.5" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"` +
        ` style="transform-origin:10px 10px;transform:rotate(${(1 - secs / (REORDER_DELAY / 1000)) * 360 * 12}deg)"/>` +
        `</svg> Reordering in <strong>${secs}</strong>s`;
    };
    update();
    clearInterval(el._tick);
    el._tick = setInterval(() => {
      secs = Math.max(0, secs - 1);
      update();
      if (secs <= 0) clearInterval(el._tick);
    }, 1000);
  };

  const hideCountdown = () => {
    const el = document.getElementById("reorder-indicator");
    if (!el) return;
    clearInterval(el._tick);
    el.hidden = true;
  };

  const scheduleReorder = () => {
    showCountdown();
    clearTimeout(reorderTimer);
    reorderTimer = setTimeout(() => {
      hideCountdown();
      renderQueue();
      updateConstellation();
    }, REORDER_DELAY);
  };

  const render = ({ reorderPrinciples = false, immediate = false } = {}) => {
    inputs.forEach((input, index) => { document.querySelector(`#o-${names[index]}`).value = weightLabel(input.value); });
    const allocated = inputs.reduce((sum, input) => sum + Number(input.value), 0);
    document.querySelector("#allocation").textContent = `Priority budget: ${weightLabel(allocated)} / 100 allocated`;
    if (reorderPrinciples) updateRankBadges();
    renderPrincipleStatuses();
    if (immediate) {
      clearTimeout(reorderTimer);
      hideCountdown();
      renderQueue();
      updateConstellation();
    } else {
      scheduleReorder();
    }
  };

  const setPreset = (name) => {
    inputs.forEach((input, index) => { input.value = String(presets[name][index]); });
    document.querySelectorAll(".preset").forEach((button) => button.classList.toggle("active", button.dataset.preset === name));
    persistWorkspace();
    render({ reorderPrinciples: true });
  };

  const editor = document.querySelector("#principle-editor");
  const promptInput = document.querySelector("#principle-prompt");
  const promptError = document.querySelector("#principle-prompt-error");

  const openPrincipleEditor = (name) => {
    activePrinciple = name;
    document.querySelector("#principle-editor-title").textContent = principles[name].name;
    promptInput.value = principles[name].prompt;
    promptError.hidden = true;
    promptError.textContent = "";
    renderPrincipleStatuses();
    editor.showModal();
    promptInput.focus();
  };

  const savePromptFromEditor = () => {
    const prompt = promptInput.value.trim();
    if (prompt.length < 10) {
      promptError.textContent = "Prompt must contain at least 10 characters.";
      promptError.hidden = false;
      return false;
    }
    principles[activePrinciple].prompt = prompt;
    principles[activePrinciple].error = "";
    promptError.hidden = true;
    persistWorkspace();
    render({ immediate: true });
    return true;
  };

  const queueRequest = (name) => ({
    schema: REQUEST_SCHEMA,
    principle: { id: name, name: principles[name].name, prompt: principles[name].prompt },
    initiatives: initiatives.map(({ id, name: itemName, category, horizon, summary, customer_value, leverage, risk, ai_fit, cost, dependency, proof }) => ({
      id, name: itemName, category, horizon, summary, customer_value, leverage, risk, ai_fit, cost, dependency, proof,
    })),
  });

  const validateResult = (name, result) => {
    if (!result || result.schema !== RESULT_SCHEMA || result.principle_id !== name || !Array.isArray(result.scores) || result.scores.length !== initiatives.length) {
      throw new Error("The evaluator returned an incomplete score set.");
    }
    const seen = new Set();
    const byId = new Map();
    result.scores.forEach((row) => {
      if (!row || typeof row.initiative_id !== "string" || seen.has(row.initiative_id) || !Number.isInteger(row.score) || row.score < 0 || row.score > 100 || typeof row.reason !== "string" || !row.reason.trim()) {
        throw new Error("The evaluator returned an invalid score set.");
      }
      seen.add(row.initiative_id);
      byId.set(row.initiative_id, row);
    });
    if (initiatives.some((item) => !byId.has(item.id))) throw new Error("The evaluator omitted a queue item.");
    return byId;
  };

  const rescorePrinciple = async (name) => {
    const principle = principles[name];
    if (principle.running) return false;
    principle.running = true;
    principle.error = "";
    render({ immediate: true });
    let succeeded = false;
    try {
      const response = await fetch("/api/rescore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queueRequest(name)),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || !result.ok) {
        throw new Error(result && result.error && result.error.message ? result.error.message : `Re-score failed (${response.status}).`);
      }
      const byId = validateResult(name, result);
      const column = names.indexOf(name);
      initiatives.forEach((item) => {
        const scored = byId.get(item.id);
        item.scores[column] = scored.score;
        item.scoreReasons[name] = scored.reason.trim();
        delete item.overrides[column]; // AI ownership clears manual override for this column
      });
      principle.scoredPrompt = principle.prompt;
      principle.provenance = {
        ...(result.provenance && typeof result.provenance === "object" ? result.provenance : { kind: "model", model: "unknown" }),
        prompt_hash: result.prompt_hash,
        queue_hash: result.queue_hash,
        request_hash: result.request_hash,
        result_hash: result.result_hash,
      };
      persistWorkspace();
      persistSession();
      succeeded = true;
    } catch (error) {
      principle.error = String(error && error.message ? error.message : error).slice(0, 180);
    } finally {
      principle.running = false;
      render({ immediate: true });
      renderDetail(initiatives.find((item) => item.id === selected));
      if (activePrinciple === name) {
        promptError.textContent = principle.error;
        promptError.hidden = !principle.error;
      }
    }
    return succeeded;
  };

  const money = (value) => new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);

  const renderCost = () => {
    const get = (id) => Math.max(0, Number(document.querySelector(`#${id}`).value) || 0);
    const units = get("units-day");
    const variable = get("variable-unit");
    const fixed = get("fixed-month");
    const customers = Math.max(1, get("customers"));
    const margin = Math.min(0.95, get("margin") / 100);
    const daily = units * variable;
    const monthly = daily * 30 + fixed;
    const costUnit = units ? monthly / (units * 30) : 0;
    const priceFloor = monthly / customers / (1 - margin);
    document.querySelector("#daily-variable").textContent = money(daily);
    document.querySelector("#monthly-total").textContent = money(monthly);
    document.querySelector("#cost-unit").textContent = money(costUnit);
    document.querySelector("#price-floor").textContent = money(priceFloor);
    document.querySelector("#cost-guardrail").textContent = `Daily review threshold: ${money(daily * 1.2 + fixed / 30)}. This is 120% of modeled daily operating spend, not an automatic provider shutoff.`;
  };

  // ── Constellation visualization (3D Canvas renderer) ─────────────────
  const HORIZON_COLOR = { now: "#2dd4a0", next: "#5aabf5", later: "#7a9ab0", parked: "#f07070" };
  const HORIZON_GLOW  = { now: "#14b880", next: "#3d8ed6", later: "#4e6d80", parked: "#d04040" };
  const CLUSTER_COLOR = {
    "SRE / Infrastructure": "#58a6ff",
    "SRE / Security":       "#f778ba",
    "SRE / AI Platform":    "#bc8cff",
    "Cost / SRE":           "#d29922",
    "SRE / Supply Chain":   "#3fb950",
    "SRE / Performance":    "#58a6ff",
    "SRE / Compliance":     "#8b949e",
  };

  const initConstellation = () => {
    const panel = document.getElementById("constellation-inner");
    if (!panel) return;
    const cPanel = document.getElementById("constellation-panel");

    // ── Canvas setup ────────────────────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block;cursor:grab;";
    panel.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let CW = 0, CH = 0, DPR = 1;
    const resize = () => { DPR = Math.min(devicePixelRatio || 1, 2); CW = panel.clientWidth; CH = panel.clientHeight; canvas.width = CW * DPR; canvas.height = CH * DPR; canvas.style.width = CW + "px"; canvas.style.height = CH + "px"; };
    resize(); window.addEventListener("resize", resize);

    // ── Color helpers ───────────────────────────────────────────────────
    const hexRgb = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const rgba = (hex, a) => { const [r,g,b] = hexRgb(hex); return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`; };
    const mixHex = (a, b, t) => { const A=hexRgb(a), B=hexRgb(b); return "#"+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,"0")).join(""); };
    const wScore = (item) => weightedScore(item);
    // Star size = rank-based (top-ranked = biggest, bottom = smallest)
    const starR = (item) => {
      const ranked = [...initiatives].sort((a, b) => weightedScore(b) - weightedScore(a));
      const rank = ranked.indexOf(item);
      const t = 1 - rank / Math.max(1, ranked.length - 1); // 1=top, 0=bottom
      return 1.5 + t * 6.5; // range 1.5 to 8
    };
    // Star color = category/cluster color (maps to which principles dominate that category)
    const starColor = (item) => {
      const s = wScore(item);
      const base = CLUSTER_COLOR[item.category] || "#5aabf5";
      if (s >= 62) return mixHex(base, "#ffffff", 0.45); // bright version for top stars
      if (s >= 50) return mixHex(base, "#ffffff", 0.25);
      return base;
    };
    const shortLabel = (name) => name.replace(/^(COST[:/]?\s*|SRE-\d+[:/]?\s*|Igor[:/]?\s*|GLI[:/]?\s*|Lambda\s|Agent-Assisted\s|Supply Chain\s)/i, "").replace(/\s*\([^)]*\)\s*$/, "").trim().slice(0, 30);

    // ── 3D anchors per category (on a sphere — golden angle) ────────────
    const catKeys = [...new Set(initiatives.map((d) => d.category))];
    const anchorFor = (ci) => {
      const n = catKeys.length, t = (ci + 0.5) / n;
      const phi = Math.acos(1 - 2 * t), theta = Math.PI * (1 + Math.sqrt(5)) * ci, R = 280;
      return { x: R * Math.sin(phi) * Math.cos(theta), y: R * 0.6 * Math.cos(phi), z: R * Math.sin(phi) * Math.sin(theta) };
    };

    // ── Build 3D nodes ──────────────────────────────────────────────────
    const nodes3d = initiatives.map((item) => {
      const ci = catKeys.indexOf(item.category);
      const a = anchorFor(ci);
      return {
        item, id: item.id, cat: item.category,
        x: a.x + (Math.random() - 0.5) * 130, y: a.y + (Math.random() - 0.5) * 130, z: a.z + (Math.random() - 0.5) * 130,
        vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, ss: 0, sz: 1,
        phase: Math.random() * Math.PI * 2, tw: 0.5 + Math.random() * 1.1,
      };
    });
    const byId3d = Object.fromEntries(nodes3d.map((n) => [n.id, n]));

    // ── Similarity links ────────────────────────────────────────────────
    const cosSim = (a, b) => { const ws = inputs.map((inp) => Number(inp.value)); const tot = ws.reduce((s, w) => s + w, 0) || 1; const va = a.scores.map((s, i) => (s/100)*(ws[i]/tot)); const vb = b.scores.map((s, i) => (s/100)*(ws[i]/tot)); const dot = va.reduce((s,v,i) => s+v*vb[i], 0); const mA = Math.sqrt(va.reduce((s,v) => s+v*v, 0)); const mB = Math.sqrt(vb.reduce((s,v) => s+v*v, 0)); return mA && mB ? dot/(mA*mB) : 0; };
    let edges3d = [];
    const rebuildLinks = () => {
      edges3d = [];
      for (let i = 0; i < initiatives.length; i++) for (let j = i + 1; j < initiatives.length; j++) {
        const s = cosSim(initiatives[i], initiatives[j]);
        if (s >= 0.88) edges3d.push({ a: byId3d[initiatives[i].id], b: byId3d[initiatives[j].id], sim: s, cross: initiatives[i].category !== initiatives[j].category });
      }
    };
    rebuildLinks();

    // ── MST per category (constellation skeleton) ───────────────────────
    const familyMST = (cat) => {
      const fn = nodes3d.filter((n) => n.cat === cat);
      if (fn.length < 2) return [];
      const inTree = [fn[0]], out = fn.slice(1), lines = [];
      while (out.length) {
        let best = null, bi = -1, bd = Infinity;
        for (let i = 0; i < out.length; i++) for (const t of inTree) {
          const d = (out[i].x-t.x)**2 + (out[i].y-t.y)**2 + (out[i].z-t.z)**2;
          if (d < bd) { bd = d; best = t; bi = i; }
        }
        lines.push([best, out[bi]]); inTree.push(out[bi]); out.splice(bi, 1);
      }
      return lines;
    };

    // ── 3D camera ───────────────────────────────────────────────────────
    const cam = { yaw: -0.4, pitch: 0.18, dist: 820, fov: 750, target: { x: 0, y: 0, z: 0 } };
    let lastInteract = 0;

    const project = (px, py, pz) => {
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const x = px - cam.target.x, y = py - cam.target.y, z = pz - cam.target.z;
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy, y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const zc = z2 + cam.dist;
      if (zc < 50) return null;
      const s = cam.fov / zc;
      return { x: CW / 2 + x1 * s, y: CH / 2 + y2 * s, s, z: zc };
    };
    const depthFade = (z) => Math.max(0.25, Math.min(1, 1.5 - z / (cam.dist * 1.6)));

    // ── Background dust (parallax) ──────────────────────────────────────
    const dust = [];
    for (let i = 0; i < 450; i++) dust.push({ ax: Math.random()*Math.PI*2, ay: (Math.random()-0.5)*Math.PI, depth: 0.3+Math.random()*0.7, s: Math.random()*0.65+0.2, a: 0.03+Math.random()*0.2, warm: Math.random()<0.25, ph: Math.random()*Math.PI*2 });

    // ── 3D physics tick ─────────────────────────────────────────────────
    const physicsTick = () => {
      const REPEL = 2800, DAMP = 0.85;
      for (let i = 0; i < nodes3d.length; i++) {
        const n = nodes3d[i];
        for (let j = i + 1; j < nodes3d.length; j++) {
          const m = nodes3d[j];
          let dx = n.x-m.x, dy = n.y-m.y, dz = n.z-m.z, d2 = dx*dx+dy*dy+dz*dz;
          if (d2 < 1) { dx = Math.random()-0.5; dy = Math.random()-0.5; dz = Math.random()-0.5; d2 = 1; }
          if (d2 > 180000) continue;
          const d = Math.sqrt(d2), f = REPEL / d2;
          const fx = dx/d*f, fy = dy/d*f, fz = dz/d*f;
          n.vx += fx; n.vy += fy; n.vz += fz; m.vx -= fx; m.vy -= fy; m.vz -= fz;
        }
        const a = anchorFor(catKeys.indexOf(n.cat));
        n.vx += (a.x - n.x) * 0.008; n.vy += (a.y - n.y) * 0.008; n.vz += (a.z - n.z) * 0.008;
      }
      edges3d.forEach((e) => {
        const rest = e.cross ? 260 : (e.sim > 0.95 ? 55 : 90);
        const k = e.cross ? 0.004 : 0.015 * (e.sim > 0.95 ? 1.1 : 0.7);
        const dx = e.b.x-e.a.x, dy = e.b.y-e.a.y, dz = e.b.z-e.a.z;
        const d = Math.max(1, Math.hypot(dx, dy, dz)), f = (d - rest) * k;
        const fx = dx/d*f, fy = dy/d*f, fz = dz/d*f;
        e.a.vx += fx; e.a.vy += fy; e.a.vz += fz; e.b.vx -= fx; e.b.vy -= fy; e.b.vz -= fz;
      });
      nodes3d.forEach((n) => {
        n.vx *= DAMP; n.vy *= DAMP; n.vz *= DAMP;
        const sp = Math.hypot(n.vx, n.vy, n.vz); if (sp > 10) { const s = 10/sp; n.vx *= s; n.vy *= s; n.vz *= s; }
        n.x += n.vx; n.y += n.vy; n.z += n.vz;
      });
    };

    // ── Mouse / touch interaction ───────────────────────────────────────
    let orbiting = false, panning = false, lastMouse = { x: 0, y: 0 }, hoverNode = null;
    const nodeAt = (sx, sy) => { let best = null, bd = Infinity; nodes3d.forEach((n) => { if (!n.ss) return; const d = Math.hypot(n.sx-sx, n.sy-sy); const hit = Math.max(10, starR(n.item)*n.ss+6); if (d < hit && d < bd) { bd = d; best = n; } }); return best; };

    canvas.addEventListener("mousedown", (e) => { if (e.shiftKey || e.button === 2) panning = true; else orbiting = true; lastMouse = { x: e.clientX, y: e.clientY }; canvas.style.cursor = "grabbing"; lastInteract = performance.now(); });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("mousemove", (e) => {
      const dx = e.clientX - lastMouse.x, dy = e.clientY - lastMouse.y; lastMouse = { x: e.clientX, y: e.clientY };
      if (orbiting) { cam.yaw += dx * 0.004; cam.pitch = Math.max(-1.2, Math.min(1.2, cam.pitch + dy * 0.003)); lastInteract = performance.now(); return; }
      if (panning) { const k = cam.dist / cam.fov; const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw); cam.target.x -= (cy*dx)*k; cam.target.y -= dy*k; cam.target.z -= (-sy*dx)*k; lastInteract = performance.now(); return; }
      const rect = canvas.getBoundingClientRect(); hoverNode = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
      canvas.style.cursor = hoverNode ? "pointer" : "grab";
    });
    window.addEventListener("mouseup", (e) => {
      if (!orbiting && !panning) { const rect = canvas.getBoundingClientRect(); const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top); if (n) { selected = n.id; renderQueue(); renderDetail(n.item); } }
      orbiting = false; panning = false; canvas.style.cursor = "grab";
    });
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); cam.dist = Math.max(240, Math.min(2400, cam.dist * Math.exp(e.deltaY * 0.001))); lastInteract = performance.now(); }, { passive: false });

    // Touch support
    let touchStart = null, pinchDist = 0;
    canvas.addEventListener("touchstart", (e) => { lastInteract = performance.now(); if (e.touches.length === 1) { touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; lastMouse = { ...touchStart }; } else if (e.touches.length === 2) { pinchDist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); } }, { passive: true });
    canvas.addEventListener("touchmove", (e) => { lastInteract = performance.now(); if (e.touches.length === 1) { const t = e.touches[0]; cam.yaw += (t.clientX-lastMouse.x)*0.004; cam.pitch = Math.max(-1.2, Math.min(1.2, cam.pitch+(t.clientY-lastMouse.y)*0.003)); lastMouse = { x: t.clientX, y: t.clientY }; } else if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); if (pinchDist) cam.dist = Math.max(240, Math.min(2400, cam.dist*pinchDist/d)); pinchDist = d; } }, { passive: true });
    canvas.addEventListener("touchend", (e) => { if (touchStart && e.changedTouches.length === 1 && e.touches.length === 0) { const t = e.changedTouches[0]; if (Math.hypot(t.clientX-touchStart.x, t.clientY-touchStart.y) < 8) { const rect = canvas.getBoundingClientRect(); const n = nodeAt(t.clientX-rect.left, t.clientY-rect.top); if (n) { selected = n.id; renderQueue(); renderDetail(n.item); } } } touchStart = null; pinchDist = 0; });

    // ── Tooltip ──────────────────────────────────────────────────────────
    const tipEl = document.createElement("div");
    tipEl.style.cssText = "position:absolute;pointer-events:none;opacity:0;transition:opacity .12s;z-index:20;background:rgba(4,7,16,.94);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:9px 13px;font-size:12px;color:#deeaf5;max-width:240px;line-height:1.45;backdrop-filter:blur(6px);";
    cPanel.appendChild(tipEl);

    // ── Legend ───────────────────────────────────────────────────────────
    const updateLegend = () => {
      const ws = inputs.map((inp, i) => ({ label: principles[names[i]].name.replace("AI Infrastructure Leverage", "AI Infra"), w: Number(inp.value) })).sort((a, b) => b.w - a.w).slice(0, 3);
      const el = document.getElementById("constellation-legend"); if (!el) return; el.replaceChildren();
      [["now","#2dd4a0"],["next","#5aabf5"],["later","#7a9ab0"],["parked","#f07070"]].forEach(([h,c]) => { const s = document.createElement("span"); s.className = "constellation-legend-item"; const d = document.createElement("span"); d.className = "constellation-legend-dot"; d.style.cssText = `background:${c};color:${c};`; s.append(d, document.createTextNode(h)); el.appendChild(s); });
      const sep = document.createElement("span"); sep.style.cssText = "color:rgba(255,255,255,.18);font-size:10px;"; sep.textContent = "clustering by:"; el.appendChild(sep);
      ws.forEach(({ label, w }) => { const s = document.createElement("span"); s.className = "constellation-legend-item"; s.style.color = "rgba(245,166,35,.65)"; s.textContent = `${label} ${Math.round(w)}%`; el.appendChild(s); });
    };

    // ── Render frame ────────────────────────────────────────────────────
    const draw = (now) => {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, CW, CH);
      // Background
      ctx.fillStyle = "#04060c";
      ctx.fillRect(0, 0, CW, CH);
      const bg = ctx.createRadialGradient(CW/2, CH/2, 0, CW/2, CH/2, Math.max(CW,CH)*0.7);
      bg.addColorStop(0, "rgba(20,28,50,0.3)"); bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);

      // Dust (parallax)
      dust.forEach((d) => {
        const px = ((d.ax + cam.yaw*d.depth*0.35) / (Math.PI*2) % 1 + 1) % 1 * (CW+60) - 30;
        const py = ((d.ay + cam.pitch*d.depth*0.5) / Math.PI % 1 + 1) % 1 * (CH+60) - 30;
        const tw = 0.8 + 0.2 * Math.sin(now * 0.001 * d.depth + d.ph);
        ctx.fillStyle = d.warm ? `rgba(235,220,195,${d.a*tw})` : `rgba(200,212,238,${d.a*tw})`;
        ctx.beginPath(); ctx.arc(px, py, d.s, 0, Math.PI*2); ctx.fill();
      });

      // Project all nodes
      nodes3d.forEach((n) => { const p = project(n.x, n.y, n.z); if (p) { n.sx = p.x; n.sy = p.y; n.ss = p.s; n.sz = p.z; } else n.ss = 0; });

      // MST constellation skeleton per category
      catKeys.forEach((k) => {
        const lc = mixHex(CLUSTER_COLOR[k] || "#5a7a90", "#96a4c4", 0.4);
        familyMST(k).forEach(([a, b]) => {
          if (!a.ss || !b.ss) return;
          const fade = Math.min(depthFade(a.sz), depthFade(b.sz));
          ctx.strokeStyle = rgba(lc, 0.12 * fade); ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
        });
      });

      // Similarity edges
      edges3d.forEach((e) => {
        if (!e.a.ss || !e.b.ss) return;
        const fade = Math.min(depthFade(e.a.sz), depthFade(e.b.sz));
        const hot = hoverNode && (e.a === hoverNode || e.b === hoverNode);
        ctx.strokeStyle = hot ? "rgba(210,225,245,0.6)" : rgba(CLUSTER_COLOR[e.a.cat] || "#5aabf5", (e.cross ? 0.04 : 0.14) * e.sim * fade);
        ctx.lineWidth = hot ? 1 : (e.sim > 0.95 ? 0.7 : 0.4);
        ctx.beginPath(); ctx.moveTo(e.a.sx, e.a.sy); ctx.lineTo(e.b.sx, e.b.sy); ctx.stroke();
      });

      // Stars — painter's order (far → near)
      const ordered = [...nodes3d].sort((a, b) => b.sz - a.sz);
      const labels = [];
      ordered.forEach((n) => {
        if (!n.ss) return;
        const fade = depthFade(n.sz);
        if (n.sx < -30 || n.sx > CW+30 || n.sy < -30 || n.sy > CH+30) return;
        const tw = 1 + 0.07 * Math.sin(now * 0.001 * n.tw + n.phase);
        const r = Math.max(0.8, Math.min(6, starR(n.item) * n.ss * 0.55)) * tw;
        const color = starColor(n.item);
        const A = fade;
        const isSel = n.id === selected;
        const isHot = n === hoverNode;
        const isTop = wScore(n.item) >= 50;

        // Glow halo for bigger stars
        if (isTop || isSel) {
          const gR = r * (isSel ? 5 : 3.5);
          const gA = (isSel ? 0.18 : 0.1) * A;
          const g = ctx.createRadialGradient(n.sx, n.sy, 0, n.sx, n.sy, gR);
          g.addColorStop(0, rgba(color, gA)); g.addColorStop(1, rgba(color, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.sx, n.sy, gR, 0, Math.PI*2); ctx.fill();
        }

        // Core
        ctx.fillStyle = rgba(color, Math.min(1, (isTop ? 0.95 : 0.7) * A));
        ctx.beginPath(); ctx.arc(n.sx, n.sy, r, 0, Math.PI*2); ctx.fill();
        // White center
        if (isTop || isSel) {
          ctx.fillStyle = `rgba(255,255,255,${0.9 * A})`;
          ctx.beginPath(); ctx.arc(n.sx, n.sy, r * 0.35, 0, Math.PI*2); ctx.fill();
        }

        // Hover ring
        if (isHot || isSel) {
          ctx.strokeStyle = `rgba(220,232,250,${isSel ? 0.7 : 0.5})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(n.sx, n.sy, r + 4, 0, Math.PI*2); ctx.stroke();
        }

        // Status ring
        const st = statuses[n.id];
        if (st) {
          const rc = { blocked: "#fca5a5", "in-progress": "#5aabf5", done: "#2dd4a0", deferred: "#7a9ab0" }[st] || "#5aabf5";
          ctx.strokeStyle = rgba(rc, 0.5 * A); ctx.lineWidth = 0.7; ctx.setLineDash([3,3]);
          ctx.beginPath(); ctx.arc(n.sx, n.sy, r + 6, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        }

        if (A > 0.25) labels.push({ n, r, A });
      });

      // Labels
      ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "left";
      const placed = [];
      labels.sort((a, b) => (b.n === hoverNode) - (a.n === hoverNode) || starR(b.n.item) - starR(a.n.item));
      labels.forEach(({ n, r, A }) => {
        const hot = n === hoverNode || n.id === selected;
        const text = shortLabel(n.item.name);
        const x = n.sx + r + 6, y = n.sy + 3;
        const box = { x: x-2, y: y-10, w: text.length*5.8+4, h: 14 };
        const clash = !hot && placed.some((b) => box.x < b.x+b.w && box.x+box.w > b.x && box.y < b.y+b.h && box.y+box.h > b.y);
        if (clash) return;
        placed.push(box);
        ctx.fillStyle = `rgba(196,208,232,${(hot ? 0.92 : 0.38) * A})`;
        ctx.fillText(text, x, y);
      });

      // Category names
      catKeys.forEach((k) => {
        const fn = nodes3d.filter((n) => n.cat === k && n.ss);
        if (fn.length < 2) return;
        let cx = 0, topY = Infinity, cz = 0;
        fn.forEach((n) => { cx += n.sx; cz += n.sz; topY = Math.min(topY, n.sy); }); cx /= fn.length; cz /= fn.length;
        const alpha = 0.25 * depthFade(cz);
        const catLabel = k.split("/").pop().trim().toUpperCase().split("").join(" ");
        ctx.font = "500 9px system-ui, sans-serif"; ctx.textAlign = "center";
        ctx.fillStyle = rgba(CLUSTER_COLOR[k] || "#5a7a90", alpha);
        ctx.fillText(catLabel, cx, topY - 18);
      });

      // ── Legend key (bottom-left) ──────────────────────────────────────
      const kx = 16, ky = CH - 14;
      ctx.globalAlpha = 0.7;
      ctx.font = "bold 8px system-ui, sans-serif"; ctx.textAlign = "left";

      // Category color key
      let ly = ky;
      catKeys.forEach((k) => {
        const c = CLUSTER_COLOR[k] || "#5a7a90";
        const label = k.split("/").pop().trim();
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(kx + 4, ly - 3, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(196,208,232,0.55)`;
        ctx.fillText(label, kx + 12, ly);
        ly -= 14;
      });

      // Size scale
      ly -= 6;
      ctx.fillStyle = "rgba(196,208,232,0.4)";
      ctx.font = "bold 7px system-ui, sans-serif";
      ctx.fillText("SIZE = RANK", kx, ly); ly -= 12;
      [[7, "Top"], [4, "Mid"], [1.8, "Low"]].forEach(([r, label]) => {
        ctx.fillStyle = "rgba(180,200,230,0.5)";
        ctx.beginPath(); ctx.arc(kx + 4, ly - r, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(196,208,232,0.4)";
        ctx.fillText(label, kx + 14, ly - r + 3);
        ly -= r * 2 + 6;
      });

      ctx.globalAlpha = 1;

      // Tooltip
      if (hoverNode && !orbiting) {
        const rect = cPanel.getBoundingClientRect();
        const sc = statuses[hoverNode.id];
        const statusHtml = sc ? `<span style="color:${{"blocked":"#fca5a5","in-progress":"#5aabf5","done":"#2dd4a0","deferred":"#5a7a90"}[sc]||"#fff"};font-weight:700;">${STATUS_LABELS[sc]}</span> · ` : "";
        tipEl.innerHTML = `<strong style="display:block;font-size:12px;margin-bottom:3px;">${hoverNode.item.name}</strong><span style="color:#5a7a90;font-size:10px;">${statusHtml}${hoverNode.cat} · ${hoverNode.item.horizon}</span><br><span style="color:#f5a623;font-weight:700;">${wScore(hoverNode.item).toFixed(1)} pts</span><span style="color:#5a7a90;font-size:10px;"> · effort ${hoverNode.item.effort}/5</span>`;
        tipEl.style.left = Math.min(lastMouse.x - rect.left + 14, CW - 260) + "px";
        tipEl.style.top = Math.max(lastMouse.y - rect.top - 8, 50) + "px";
        tipEl.style.opacity = "1";
      } else { tipEl.style.opacity = "0"; }
    };

    // ── Warm-up physics ─────────────────────────────────────────────────
    for (let i = 0; i < 350; i++) physicsTick();

    // ── Animation loop ──────────────────────────────────────────────────
    let animId = null;
    const frame = (now) => {
      // Auto-rotate when idle
      if (now - lastInteract > 3500 && !orbiting && !panning) cam.yaw += 0.0004;
      physicsTick();
      draw(now);
      animId = requestAnimationFrame(frame);
    };
    animId = requestAnimationFrame(frame);

    // ── Collapse button ─────────────────────────────────────────────────
    const collapseBtn = document.getElementById("constellation-collapse");
    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => {
        const isCollapsed = cPanel.classList.toggle("collapsed");
        collapseBtn.textContent = isCollapsed ? "▸" : "▾";
        collapseBtn.setAttribute("aria-expanded", String(!isCollapsed));
        collapseBtn.title = isCollapsed ? "Expand constellation" : "Collapse constellation";
        document.documentElement.style.setProperty("--constellation-h", isCollapsed ? "44px" : "384px");
        if (isCollapsed && animId) { cancelAnimationFrame(animId); animId = null; }
        else if (!isCollapsed && !animId) { resize(); animId = requestAnimationFrame(frame); }
      });
    }

    // Expose update for weight/score changes
    panel._update = () => { rebuildLinks(); updateLegend(); };
    updateLegend();
  };

  const updateConstellation = () => {
    const inner = document.getElementById("constellation-inner");
    if (inner && inner._update) inner._update();
  };

  // ── Scenario bar ──────────────────────────────────────────────────────
  const renderScenarioBar = () => {
    let bar = document.getElementById("scenario-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "scenario-bar";
      bar.className = "scenario-bar";
      const wrap = document.querySelector(".portfolio-wrap");
      wrap.parentNode.insertBefore(bar, wrap);
    }
    bar.replaceChildren();

    const label = document.createElement("span");
    label.className = "scenario-bar-label";
    label.textContent = "Scenarios";
    bar.appendChild(label);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "scenario-save-btn";
    saveBtn.textContent = "+ Save current";
    saveBtn.addEventListener("click", () => {
      const scenarioName = window.prompt("Scenario name:");
      if (!scenarioName || !scenarioName.trim()) return;
      scenarios.push({
        name: scenarioName.trim(),
        weights: inputs.map((inp) => Number(inp.value)),
        overrides: Object.fromEntries(initiatives.map((item) => [item.id, { ...item.overrides }])),
        statuses: { ...statuses },
      });
      persistSession();
      renderScenarioBar();
    });
    bar.appendChild(saveBtn);

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "reset-overrides-btn";
    resetBtn.textContent = "Clear all marks";
    resetBtn.title = "Clear all score overrides, effort overrides, and color marks — restore everything to defaults";
    resetBtn.addEventListener("click", () => {
      initiatives.forEach((item) => {
        item.overrides = {};
        item.scores = [...item.baseScores];
        item.effort = item.seedEffort;
        item.effortOverridden = false;
      });
      Object.keys(overrideColorMap).forEach((k) => delete overrideColorMap[k]);
      persistSession();
      render({ immediate: true });
      renderScenarioBar();
      const sel = initiatives.find((item) => item.id === selected);
      if (sel) renderDetail(sel);
    });
    bar.appendChild(resetBtn);

    scenarios.forEach((scenario, si) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "scenario-chip";
      chip.title = `Load scenario: ${scenario.name}`;

      const chipName = document.createElement("span");
      chipName.textContent = scenario.name;
      chip.appendChild(chipName);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "scenario-chip-del";
      del.textContent = "×";
      del.title = "Delete scenario";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        scenarios.splice(si, 1);
        persistSession();
        renderScenarioBar();
      });
      chip.appendChild(del);

      chip.addEventListener("click", () => {
        scenario.weights.forEach((w, i) => { inputs[i].value = String(w); });
        initiatives.forEach((item) => {
          item.overrides = { ...(scenario.overrides[item.id] || {}) };
          item.scores = [...item.baseScores];
          Object.entries(item.overrides).forEach(([k, v]) => { item.scores[Number(k)] = v; });
        });
        Object.assign(statuses, scenario.statuses || {});
        persistWorkspace();
        persistSession();
        render({ reorderPrinciples: true, immediate: true });
        renderScenarioBar();
        const sel = initiatives.find((item) => item.id === selected);
        if (sel) renderDetail(sel);
      });
      bar.appendChild(chip);
    });
  };

  // ── Theme switcher ────────────────────────────────────────────────────
  const THEME_KEY = "priority_foregrounds.theme/v1";
  const VALID_THEMES = ["deep-space", "glassmorphism", "editorial"];
  const applyTheme = (name) => {
    const theme = VALID_THEMES.includes(name) ? name : "deep-space";
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll(".theme-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.theme === theme);
    });
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  };
  const savedTheme = (() => { try { return localStorage.getItem(THEME_KEY); } catch (_) { return null; } })();
  applyTheme(savedTheme || "deep-space");
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyTheme(btn.dataset.theme));
  });
  // ─────────────────────────────────────────────────────────────────────

  loadWorkspace();
  initiatives.forEach((item) => { item.baseScores = [...item.scores]; }); // workspace scores before session overrides
  loadSession();
  render({ reorderPrinciples: true, immediate: true });
  rankPrinciples(); // sort once on load
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      redistribute(input);
      document.querySelectorAll(".preset").forEach((button) => button.classList.remove("active"));
      render(); // deferred — shows countdown
    });
    input.addEventListener("change", () => {
      persistWorkspace();
      render({ reorderPrinciples: true }); // still deferred; rankPrinciples is instant, queue waits
    });
  });
  document.querySelectorAll(".preset").forEach((button) => button.addEventListener("click", () => setPreset(button.dataset.preset)));
  document.querySelector("#reset").addEventListener("click", () => setPreset("balanced"));
  document.querySelector("#rerank").addEventListener("click", () => rankPrinciples());

  // ── User-saved weight presets ─────────────────────────────────────────
  const USER_PRESETS_KEY = "priority_foregrounds.user_presets/v1";
  let userPresets = []; // [{name, weights:[...]}]
  try { userPresets = JSON.parse(localStorage.getItem(USER_PRESETS_KEY) || "[]"); if (!Array.isArray(userPresets)) userPresets = []; } catch (_) { userPresets = []; }

  const persistUserPresets = () => { try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(userPresets)); } catch (_) {} };

  const renderUserPresets = () => {
    const container = document.getElementById("user-presets");
    if (!container) return;
    container.replaceChildren();
    userPresets.forEach((preset, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset user-preset";
      btn.title = `Load "${preset.name}" — weights: ${preset.weights.map(Math.round).join(", ")}`;
      btn.textContent = preset.name;
      btn.addEventListener("click", () => {
        preset.weights.forEach((w, j) => { if (j < inputs.length) inputs[j].value = String(w); });
        document.querySelectorAll(".preset").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        persistWorkspace();
        render({ reorderPrinciples: true });
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "user-preset-del";
      del.textContent = "×";
      del.title = `Delete "${preset.name}"`;
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        userPresets.splice(i, 1);
        persistUserPresets();
        renderUserPresets();
      });
      btn.appendChild(del);
      container.appendChild(btn);
    });
  };

  document.getElementById("save-preset").addEventListener("click", () => {
    const name = window.prompt("Preset name (e.g. \"David settings\"):");
    if (!name || !name.trim()) return;
    userPresets.push({ name: name.trim(), weights: inputs.map((inp) => Number(inp.value)) });
    persistUserPresets();
    renderUserPresets();
  });

  renderUserPresets();
  document.querySelectorAll("[data-edit-principle]").forEach((button) => button.addEventListener("click", () => openPrincipleEditor(button.dataset.editPrinciple)));
  document.querySelectorAll("[data-rescore-principle]").forEach((button) => button.addEventListener("click", () => rescorePrinciple(button.dataset.rescorePrinciple)));
  document.querySelector("#save-principle-prompt").addEventListener("click", () => { if (savePromptFromEditor()) editor.close(); });
  document.querySelector("#save-and-rescore").addEventListener("click", async () => { if (savePromptFromEditor() && await rescorePrinciple(activePrinciple)) editor.close(); });
  editor.addEventListener("close", () => { activePrinciple = ""; promptError.hidden = true; });
  document.querySelectorAll(".cost-inputs input").forEach((input) => input.addEventListener("input", renderCost));

  render({ reorderPrinciples: true, immediate: true });
  renderDetail(initiatives.find((item) => item.id === selected));
  renderScenarioBar();
  renderCost();
  initConstellation();
})();

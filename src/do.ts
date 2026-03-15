/**
 * AlphafoldDataDO — Durable Object for staging large AlphaFold responses.
 *
 * Extends RestStagingDO with schema hints for predicted structures.
 * Excludes bulky sequence fields that waste staging space and tokens.
 */

import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class AlphafoldDataDO extends RestStagingDO {
    protected getSchemaHints(data: unknown): SchemaHints | undefined {
        if (!data || typeof data !== "object") return undefined;

        // Top-level array: prediction response (array of isoforms/fragments)
        if (Array.isArray(data) && data.length > 0) {
            const first = data[0] as Record<string, unknown>;

            if (first.modelEntityId || first.uniprotAccession || first.entryId) {
                return {
                    tableName: "predictions",
                    indexes: [
                        "modelEntityId",
                        "entryId",
                        "uniprotAccession",
                        "gene",
                        "organismScientificName",
                        "globalMetricValue",
                    ],
                    exclude: [
                        "sequence",
                        "uniprotSequence",
                        "allVersions",
                    ],
                };
            }

            // PAE residue-level entries
            if (first.residue1 !== undefined || first.residue_1 !== undefined) {
                return {
                    tableName: "pae_residues",
                    indexes: ["residue1", "residue2"],
                };
            }
        }

        const obj = data as Record<string, unknown>;

        // PAE matrix: { predicted_aligned_error: number[][] }
        if (obj.predicted_aligned_error && Array.isArray(obj.predicted_aligned_error)) {
            return {
                tableName: "pae_matrix",
                indexes: [],
            };
        }

        // Single prediction object
        if (obj.modelEntityId || obj.uniprotAccession || obj.entryId) {
            return {
                tableName: "predictions",
                indexes: [
                    "modelEntityId",
                    "entryId",
                    "uniprotAccession",
                    "gene",
                    "organismScientificName",
                ],
                exclude: [
                    "sequence",
                    "uniprotSequence",
                    "allVersions",
                ],
            };
        }

        return undefined;
    }
}

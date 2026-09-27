/**
 * Batch Insert Utility
 * Author : Abhishek PG System
 */

const batchInsert = async (
  Model,
  documents,
  batchSize = 500
) => {
  if (!documents || documents.length === 0) {
    return {
       insertedCount: 0,
      failedCount: 0,
      failedClients: [],
      batches: 0,
    };
  }

  let insertedCount = 0;
  let failedCount = 0;
  let batchNo = 1;
  // ✅ Failed clients yaha collect honge
  const failedClients = [];



  for (
    let i = 0;
    i < documents.length;
    i += batchSize
  ) {
    const batch = documents.slice(
      i,
      i + batchSize
    );




    try {
      const result = await Model.insertMany(
        batch,
        {
          ordered: false,
        }
      );

      insertedCount += result.length;

      console.log(
        `✅ Batch ${batchNo} inserted (${result.length})`
      );
    } catch (error) {
      console.error(
        `❌ Batch ${batchNo} Error`
      );




      if (error.insertedDocs) {
        insertedCount += error.insertedDocs.length;

        failedCount +=
          batch.length -
          error.insertedDocs.length;

        // Failed clients identify karo
        const insertedClientIds = new Set(
          error.insertedDocs.map(
            (doc) => String(doc.clientId)
          )
        );

        batch.forEach((doc) => {
          if (
            !insertedClientIds.has(
              String(doc.clientId)
            )
          ) {
            failedClients.push({
              clientId: doc.clientId,
              fullName: doc.fullName || "",
              reason: error.message,
            });
          }
        });
      } else {
        failedCount += batch.length;

        // Pura batch fail hua
        batch.forEach((doc) => {
          failedClients.push({
            clientId: doc.clientId,
            fullName: doc.fullName || "",
            reason: error.message,
          });
        });
      }
      console.error(error.message);
    }

    batchNo++;
  }





 return {
  insertedCount,
  failedCount,

  // ✅ Failed clients
  failedClients,

  total: documents.length,

  batches: Math.ceil(
    documents.length / batchSize
  ),
};
};

module.exports = batchInsert;
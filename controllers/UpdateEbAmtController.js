const mongoose = require("mongoose");

const Client = require("../models/client.model");
const ClientRentHistory = require("../models/clientRentHistory.model");

const calculateRentHistory = require("../utils/calculateRentHistory");
const EBCalculation = require("../models/ebCalculationData.model");
// ======================================================
// GET ALL EB CALCULATIONS
// ======================================================
const getAllEBCalculations = async (req, res) => {
    try {
        const data = await EBCalculation.find()
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: data.length,
            data,
        });
    } catch (error) {
        console.error("GET ALL EB CALCULATIONS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch EB calculations",
            error: error.message,
        });
    }
};


// ======================================================
// GET EB CALCULATION BY ID
// ======================================================
const getEBCalculationById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid EB Calculation ID",
            });
        }

        const data = await EBCalculation.findById(id).lean();

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "EB Calculation not found",
            });
        }

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("GET EB CALCULATION BY ID ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch EB calculation",
            error: error.message,
        });
    }
};


// =====================================================
// UPDATE EB AMOUNT IN RENT HISTORY
// =====================================================

const updateEBAmountInRentHistory = async (req, res) => {
    try {
        console.log("====================================");
        console.log("UPDATE EB RENT HISTORY BODY:");
        console.log(JSON.stringify(req.body, null, 2));
        console.log("IS ARRAY:", Array.isArray(req.body));
        console.log("====================================");

        const ebData = req.body;

        // =====================================================
        // VALIDATE REQUEST
        // =====================================================

        if (!Array.isArray(ebData)) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid EB data. Expected an array.",
            });
        }

        if (ebData.length === 0) {
            return res.status(400).json({
                success: false,
                message: "EB data is empty.",
            });
        }

        // =====================================================
        // GET CLIENT IDS
        // =====================================================

        const clientIds = ebData
            .map((item) => item.ClientID)
            .filter(
                (id) =>
                    id &&
                    mongoose.Types.ObjectId.isValid(id)
            );

        if (clientIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid ClientID found.",
            });
        }

        // =====================================================
        // FETCH CLIENT DATA
        // IMPORTANT:
        // clientVacatingDate Client model se li jayegi
        // =====================================================

        const clients = await Client.find({
            _id: {
                $in: clientIds,
            },
        }).select(
            "_id clientVacatingDate"
        );

        // =====================================================
        // CREATE CLIENT MAP
        // =====================================================

        const clientMap = new Map();

        clients.forEach((client) => {
            clientMap.set(
                client._id.toString(),
                client
            );
        });

        console.log(
            "CLIENTS FOUND:",
            clients.length
        );

        // =====================================================
        // RESULTS
        // =====================================================

        const results = [];

        // =====================================================
        // PROCESS EACH CLIENT
        // =====================================================


        // ✅ TARGET MONTH CALCULATE ONCE
        const firstEBEndDate = ebData[0]?.EBEndDate
            ? new Date(ebData[0].EBEndDate)
            : null;

        if (
            !firstEBEndDate ||
            Number.isNaN(firstEBEndDate.getTime())
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid EBEndDate.",
            });
        }

        const targetDate = new Date(
            firstEBEndDate.getFullYear(),
            firstEBEndDate.getMonth() + 1,
            1
        );

        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth() + 1;


        // ✅ ONLY ONE DB QUERY
        const targetRentHistories =
            await ClientRentHistory.find({
                clientId: { $in: clientIds },
                year: targetYear,
                month: targetMonth,
            });


        // ✅ MAP
        const targetHistoryMap = new Map(
            targetRentHistories.map((history) => [
                history.clientId.toString(),
                history,
            ])
        );









        for (const ebClient of ebData) {

            const {
                ClientID,
                ClientName,
                EBAmt,
                EBEndDate,
            } = ebClient;

            // =================================================
            // CLIENT ID CHECK
            // =================================================

            if (!ClientID) {
                results.push({
                    ClientName,
                    success: false,
                    action: "ERROR",
                    errorCode:
                        "CLIENT_ID_MISSING",
                    message:
                        "ClientID is missing.",
                });

                continue;
            }


            // =================================================
            // VALID CLIENT ID CHECK
            // =================================================

            if (
                !mongoose.Types.ObjectId.isValid(
                    ClientID
                )
            ) {
                results.push({
                    ClientID,
                    ClientName,
                    success: false,
                    action: "ERROR",
                    errorCode:
                        "INVALID_CLIENT_ID",
                    message:
                        "Invalid ClientID.",
                });

                continue;
            }


            // =================================================
            // GET CLIENT FROM MAP
            // =================================================

            const dbClient =
                clientMap.get(
                    ClientID.toString()
                );


            // =================================================
            // CLIENT NOT FOUND
            // =================================================

            if (!dbClient) {
                results.push({
                    ClientID,
                    ClientName,
                    success: false,
                    action: "ERROR",
                    errorCode:
                        "CLIENT_NOT_FOUND",
                    message:
                        `Client not found for ${ClientName}.`,
                });

                continue;
            }


            // =================================================
            // EB AMOUNT
            // =================================================

            const ebAmount = Number(
                EBAmt ?? 0
            );

            if (Number.isNaN(ebAmount)) {
                results.push({
                    ClientID,
                    ClientName,
                    success: false,
                    action: "ERROR",
                    errorCode:
                        "INVALID_EB_AMOUNT",
                    message:
                        "Invalid EB amount.",
                });

                continue;
            }


            // =================================================
            // PARSE EB END DATE
            // =================================================

            const ebEndDate = EBEndDate
                ? new Date(EBEndDate)
                : null;

            if (
                !ebEndDate ||
                Number.isNaN(
                    ebEndDate.getTime()
                )
            ) {
                results.push({
                    ClientID,
                    ClientName,
                    success: false,
                    action: "ERROR",
                    errorCode:
                        "INVALID_EB_END_DATE",
                    message:
                        `Invalid EBEndDate for ${ClientName}.`,
                });

                continue;
            }


            // =================================================
            // TARGET MONTH
            // =================================================
            //
            // EB Cycle:
            //
            // 12 Aug -> 12 Sep
            //
            // Expected Rent History:
            //
            // October
            //
            // 12 Sep -> 12 Oct
            //
            // Expected Rent History:
            //
            // November
            //
            // =================================================



            // =================================================
            // FIND EXPECTED / TARGET RENT HISTORY
            // =================================================
            const targetRentHistory =
                targetHistoryMap.get(ClientID.toString());


            // =================================================
            // CASE 1:
            // TARGET HISTORY EXISTS
            // =================================================

            if (targetRentHistory) {


                // =================================================
                // UPDATE EB AMOUNT
                // =================================================

                targetRentHistory.ebAmt =
                    ebAmount;


                // =================================================
                // RENT DIVIDER
                // =================================================

                const actualLastDay =
                    new Date(
                        targetRentHistory.year,
                        targetRentHistory.month,
                        0
                    ).getDate();

                const rentDivider =
                    actualLastDay === 31
                        ? 30
                        : actualLastDay;


                // =================================================
                // RECALCULATE RENT HISTORY
                // =================================================

                const calculation =
                    calculateRentHistory({
                        monthlyRent:
                            targetRentHistory.monthlyRent,

                        depositAmount:
                            targetRentHistory.depositAmount,

                        daysCount:
                            targetRentHistory.daysCount,

                        previousDue:
                            targetRentHistory.previousDue,

                        // UPDATED EB
                        ebAmt: ebAmount,

                        flatEB:
                            targetRentHistory.flatEB,

                        adjEB:
                            targetRentHistory.adjEB,

                        adjAmt:
                            targetRentHistory.adjAmt,

                        processingFees:
                            targetRentHistory.processingFees,

                        parkingCharges:
                            targetRentHistory.parkingCharges,

                        processingFeesReceived:
                            targetRentHistory
                                .processingFeesReceived,

                        depositAmountReceived:
                            targetRentHistory
                                .depositAmountReceived,

                        // KEEP EXISTING RECEIVED AMOUNT
                        rentReceived:
                            Number(
                                targetRentHistory
                                    .totalReceived || 0
                            ),

                        rentDivider,
                    });


                // =================================================
                // APPLY CALCULATION
                // =================================================

                Object.assign(
                    targetRentHistory,
                    calculation
                );


                // =================================================
                // SAVE
                // =================================================

                await targetRentHistory.save();


                console.log(
                    "TARGET HISTORY UPDATED:",
                    {
                        ClientID,
                        ClientName,
                        year:
                            targetRentHistory.year,
                        month:
                            targetRentHistory.month,
                        ebAmt:
                            targetRentHistory.ebAmt,
                    }
                );


                results.push({
                    ClientID,
                    ClientName,
                    success: true,
                    action:
                        "TARGET_MONTH_UPDATED",

                    year:
                        targetRentHistory.year,

                    month:
                        targetRentHistory.month,

                    rentHistoryId:
                        targetRentHistory._id,

                    ebAmount,
                });


                continue;
            }


            // =================================================
            // CASE 2:
            // TARGET HISTORY DOES NOT EXIST
            // =================================================
            //
            // ABHI CHECK HOGA:
            //
            // clientVacatingDate hai?
            //
            // YES -> latest history update
            //
            // NO -> ERROR
            //
            // =================================================

            const clientVacatingDate =
                dbClient.clientVacatingDate;


            const hasVacatingDate =
                !!clientVacatingDate;


            console.log(
                "TARGET HISTORY NOT FOUND:",
                {
                    ClientID,
                    ClientName,
                    targetYear,
                    targetMonth,
                    clientVacatingDate,
                    hasVacatingDate,
                }
            );


            // =================================================
            // CASE 2A:
            // TARGET HISTORY NOT FOUND
            // AND NO VACATING DATE
            //
            // => ERROR
            // =================================================
            if (!hasVacatingDate) {
                results.push({
                    ClientID,
                    ClientName,
                    success: false,
                    action: "ERROR",
                    errorCode: "RENT_HISTORY_NOT_GENERATED",

                    ebAmount,

                    expectedRentHistory: {
                        month: targetMonth,
                        year: targetYear,
                    },

                    clientVacatingDate:
                        dbClient.clientVacatingDate || null,

                    message:
                        `Rent History not found for ${ClientName} ` +
                        `for ${targetMonth}/${targetYear}. ` +
                        `Client is not vacated, so EB was NOT updated.`,
                });

                continue;
            }


            // =================================================
            // CASE 2B:
            // TARGET HISTORY NOT FOUND
            // BUT VACATING DATE EXISTS
            //
            // => FIND LATEST HISTORY
            // =================================================

            console.log(
                "VACATING DATE EXISTS. FINDING LATEST HISTORY:",
                {
                    ClientID,
                    ClientName,
                    clientVacatingDate,
                }
            );


            const latestRentHistory =
                await ClientRentHistory.findOne({
                    clientId: ClientID,
                }).sort({
                    year: -1,
                    month: -1,
                    createdAt: -1,
                    _id: -1,
                });


            // =================================================
            // NO RENT HISTORY AT ALL
            // =================================================

            if (!latestRentHistory) {
                results.push({
                    ClientID,
                    ClientName,
                    success: false,
                    action: "ERROR",
                    errorCode: "NO_RENT_HISTORY_FOUND",

                    ebAmount,

                    expectedRentHistory: {
                        month: targetMonth,
                        year: targetYear,
                    },

                    clientVacatingDate:
                        dbClient.clientVacatingDate || null,

                    message:
                        `No Rent History found for ${ClientName}. ` +
                        `EB was NOT updated.`,
                });


                continue;
            }


            // =================================================
            // LATEST HISTORY FOUND
            // =================================================

            console.log(
                "LATEST RENT HISTORY FOUND:",
                {
                    ClientID,
                    ClientName,

                    historyId:
                        latestRentHistory._id,

                    year:
                        latestRentHistory.year,

                    month:
                        latestRentHistory.month,

                    clientVacatingDate,
                }
            );


            // =================================================
            // UPDATE EB AMOUNT IN LATEST HISTORY
            // =================================================

            latestRentHistory.ebAmt =
                ebAmount;


            // =================================================
            // RENT DIVIDER
            // =================================================

            const actualLastDay =
                new Date(
                    latestRentHistory.year,
                    latestRentHistory.month,
                    0
                ).getDate();


            const rentDivider =
                actualLastDay === 31
                    ? 30
                    : actualLastDay;


            // =================================================
            // RECALCULATE LATEST RENT HISTORY
            // =================================================

            const calculation =
                calculateRentHistory({
                    monthlyRent:
                        latestRentHistory.monthlyRent,

                    depositAmount:
                        latestRentHistory.depositAmount,

                    daysCount:
                        latestRentHistory.daysCount,

                    previousDue:
                        latestRentHistory.previousDue,

                    // UPDATED EB
                    ebAmt: ebAmount,

                    flatEB:
                        latestRentHistory.flatEB,

                    adjEB:
                        latestRentHistory.adjEB,

                    adjAmt:
                        latestRentHistory.adjAmt,

                    processingFees:
                        latestRentHistory.processingFees,

                    parkingCharges:
                        latestRentHistory.parkingCharges,

                    processingFeesReceived:
                        latestRentHistory
                            .processingFeesReceived,

                    depositAmountReceived:
                        latestRentHistory
                            .depositAmountReceived,

                    // KEEP EXISTING RECEIVED AMOUNT
                    rentReceived:
                        Number(
                            latestRentHistory
                                .totalReceived || 0
                        ),

                    rentDivider,
                });


            // =================================================
            // APPLY CALCULATION
            // =================================================

            Object.assign(
                latestRentHistory,
                calculation
            );


            // =================================================
            // SAVE
            // =================================================

            await latestRentHistory.save();


            console.log(
                "LATEST HISTORY UPDATED:",
                {
                    ClientID,
                    ClientName,

                    updatedHistoryYear:
                        latestRentHistory.year,

                    updatedHistoryMonth:
                        latestRentHistory.month,

                    ebAmt:
                        latestRentHistory.ebAmt,

                    clientVacatingDate,
                }
            );


            results.push({
                ClientID,
                ClientName,
                success: true,

                action:
                    "LATEST_HISTORY_UPDATED",

                targetYear,
                targetMonth,

                updatedHistoryYear:
                    latestRentHistory.year,

                updatedHistoryMonth:
                    latestRentHistory.month,

                clientVacatingDate,

                rentHistoryId:
                    latestRentHistory._id,

                ebAmount,
            });
        }


        // =====================================================
        // CHECK IF ANY ERROR
        // =====================================================

        const failedClients = results.filter(
            (item) => item.success === false
        );

        const updatedCount = results.filter(
            (item) => item.success === true
        ).length;

        const hasErrors = failedClients.length > 0;

        return res.status(hasErrors ? 400 : 200).json({
            success: !hasErrors,

            message: hasErrors
                ? `${failedClients.length} EB update failed.`
                : "All EB amounts updated successfully.",

            totalClients: ebData.length,
            updatedCount,
            failedCount: failedClients.length,

            failedClients,
        });

    } catch (error) {

        console.error(
            "Error updating EB amount in rent history:",
            error
        );

        return res.status(500).json({
            success: false,

            message:
                error.message ||
                "Failed to update EB amount in rent history.",
        });
    }
};


const createEBCalculation = async (req, res) => {
    try {
        const {
            PropertyCode,
            PropertyId,
            EBStartDate,
            EBEndDate,
            clients,
        } = req.body;

        if (!PropertyId) {
            return res.status(400).json({
                success: false,
                message: "PropertyId is required.",
            });
        }

        if (!Array.isArray(clients) || clients.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Clients data is required.",
            });
        }

        // 🔴 SAME EB CYCLE CHECK
        const existingCycle = await EBCalculation.findOne({
            PropertyId,
            EBStartDate,
            EBEndDate,
        });

        if (existingCycle) {
            return res.status(409).json({
                success: false,
                message: `EB calculation already exists for cycle ${EBStartDate} - ${EBEndDate}.`,
            });
        }

        // ✅ CREATE ONLY IF CYCLE DOES NOT EXIST
        const ebCalculation = await EBCalculation.create({
            PropertyCode,
            PropertyId,
            EBStartDate,
            EBEndDate,
            clients,
        });

        return res.status(201).json({
            success: true,
            message: "EB calculation created successfully.",
            data: ebCalculation,
        });

    } catch (error) {
        console.error("Create EB Calculation Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    updateEBAmountInRentHistory,
    createEBCalculation,
      getAllEBCalculations,
    getEBCalculationById,
};
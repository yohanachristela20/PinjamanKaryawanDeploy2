import Angsuran from "../models/AngsuranModel.js";
import Pinjaman from "../models/PinjamanModel.js";
import PlafondUpdate from "../models/PlafondUpdateModel.js";
import Plafond from "../models/PlafondModel.js";
import AntreanPengajuan from "../models/AntreanPengajuanModel.js";
import { Op, Sequelize, where } from "sequelize";
import db from "../config/database.js";
import { raw } from "express";

// alur update angsuran otomatis berdasarkan antrean
// const updateAngsuranOtomatis = async() => {
//     const transaction = await db.transaction();
//     try {
//         const today = new Date();
//         const formattedToday = today.toISOString().split("T")[0];
//         const dayOfMonth = today.getDate();
        
//         // Hanya eksekusi jika tanggal 1
//         if (dayOfMonth !== 7) {
//             console.log("Update angsuran otomatis hanya dijalankan pada tanggal 7.");
//             return;
//         }

//         const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
//         const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

//         const excludedPinjamanIds = await Pinjaman.findAll({
//             where: {
//                 tanggal_pengajuan: {
//                     [Op.gte]: thisMonthStart,
//                     [Op.lt]: nextMonthStart,
//                 },
//                 [Op.and]: Sequelize.where(
//                     Sequelize.fn("DATE", Sequelize.col("tanggal_pengajuan")),
//                     `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-1`
//                 ),
//             },
//             attributes: ["id_pinjaman"],
//         }).then((data) => data.map((item) => item.id_pinjaman));


//         const existingUpdate = await Angsuran.findOne({
//             where: {
//                 tanggal_angsuran: {
//                     [Op.gte]: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-1`,
//                 },
//             },
//         });

//         if (existingUpdate) {
//             console.log("Angsuran sudah diperbarui bulan ini.");
//             return;
//         }

//         // Ambil data angsuran yang belum lunas
//         const latestAngsuranData = await Angsuran.findAll({
//             attributes: [
//                 "id_pinjaman",
//                 [ Sequelize.fn("MAX", Sequelize.col("id_angsuran")), "latest_id_angsuran"],
//             ],
//             group: ["id_pinjaman"],
//             raw: true,
//         })

//         const angsuranData = await Angsuran.findAll({
//             where: {
//                 id_angsuran: {
//                     [Op.in]: latestAngsuranData.map(data => data.latest_id_angsuran)
//                 }
//             },
//             include: [
//                 {
//                     model: Pinjaman,
//                     as: 'AngsuranPinjaman',
//                     attributes: ['pinjaman_setelah_pembulatan', 'status_pelunasan', 'jumlah_angsuran'],
//                     where: {
//                         status_pelunasan: {
//                             [Op.ne]: 'Lunas',
//                         },
//                         id_pinjaman: {
//                             [Op.notIn]: excludedPinjamanIds,
//                         }
//                     },
//                 },
//             ],
//             where: {
//                 belum_dibayar: {
//                     [Op.gt]: 0, //operator greater than
//                 },
//                 bulan_angsuran: {
//                     [Op.lt]: 60, //operator less than
//                 },
//             },
//             order: [["id_pinjaman", "ASC"], ["id_angsuran", "DESC"]],
//         });

//         const result = {};
//         angsuranData.forEach((item) => {
//         if (!result[item.id_pinjaman]) {
//             result[item.id_pinjaman] = item;
//         }
//         });

//         const angsuranDataTerakhir = Object.values(result);

//         // let antreans = await AntreanPengajuan.findAll({
//         //     attributes: ['nomor_antrean', 'id_pinjaman'],
//         //     order: [['nomor_antrean', 'ASC']],
//         // });

//         let plafondTerakhir = await PlafondUpdate.findAll({
//             attributes: ['plafond_saat_ini', 'id_pinjaman']
//         })

//         // Jika tidak ada data angsuran ditemukan
//         if (!angsuranData || angsuranData.length === 0) {
//             console.log("Tidak ada data angsuran yang perlu diproses.");
//         }

//         // Ambil ID terakhir untuk auto-increment ID
//         let lastIdNumber = 0;
//         const lastRecord = await Angsuran.findOne({ order: [["id_angsuran", "DESC"]] });
//         if (lastRecord && lastRecord.id_angsuran) {
//             lastIdNumber = parseInt(lastRecord.id_angsuran.substring(1), 10);
//         }

//         const angsuranPertama = await Pinjaman.findAll({
//             where: {
//                 status_pelunasan: {
//                     [Op.ne]: 'Lunas',
//                 },
//                 status_pengajuan: {
//                     [Op.notIn]: ['Ditunda', 'Dibatalkan'],
//                 },
//                 status_transfer: {
//                     [Op.notIn]: ['Belum Ditransfer', 'Dibatalkan'],
//                 },
//             },
//             attributes: ['id_pinjaman', 'jumlah_angsuran', 'pinjaman_setelah_pembulatan', 'id_peminjam'],
//         });


//         // (Jika di Angsuran = null)
//         for (const item of angsuranPertama) {
//             const existingAngsuranPertama = await Angsuran.findOne({
//                 where: {
//                     id_pinjaman: item.id_pinjaman,
//                     bulan_angsuran: 1,
//                 },
//             });


//             if (!existingAngsuranPertama) {
//                 lastIdNumber++;
//                 const newId = `A${lastIdNumber.toString().padStart(5, "0")}`;

//                 const potongan = item.jumlah_angsuran;
//                 let itemsudahdibayar = item.sudah_dibayar;
                
//                 const belumDibayar = parseFloat((item.pinjaman_setelah_pembulatan - potongan).toFixed(2));
//                 const statusBaru = belumDibayar <= 0 ? 'Lunas' : 'Belum Lunas';
//                 const peminjam = item.id_peminjam;

//                 let sum = potongan + itemsudahdibayar;
//                 let parts = sum.toString().split(".");
//                 if (parts.length > 1 && parts[1].length > 2) {
//                     sum = parseFloat(parts[0] + "." + parts[1].substring(0, 2));
//                 }

//                 await Angsuran.create({
//                     id_angsuran: newId,
//                     tanggal_angsuran: formattedToday,
//                     sudah_dibayar: potongan,
//                     belum_dibayar: Math.max(0, belumDibayar),
//                     bulan_angsuran: 1,
//                     status: statusBaru,
//                     id_peminjam: peminjam,
//                     id_pinjaman: item.id_pinjaman,
//                 });

//                 if (statusBaru === 'Lunas') {
//                     await Pinjaman.update(
//                         { status_pelunasan: 'Lunas' },
//                         { where: { id_pinjaman: item.id_pinjaman } }
//                     );
//                 }

//                 let totalDibayar = angsuranPertama.reduce((sum, data) => sum + parseFloat(data.jumlah_angsuran || 0) , 0);
//                 console.log("Total dibayar: ", totalDibayar); 
//                 let totalDibayarAwal = totalDibayar;
//                 console.log("Total dibayar: ", totalDibayar);

//             for (const antrean of antreans) {    
//                 if (totalDibayar <=0) break;        
//                 const latestPlafond = await PlafondUpdate.findOne({ where: { id_pinjaman: antrean.id_pinjaman }, transaction })
//                         // : await PlafondUpdate.findOne({ order: [["id_plafondupdate", "DESC"]] });
            
//                 if (!latestPlafond) {
//                     return res.status(404).json({ message: "Data plafond tidak ditemukan" });
//                 }

//                 await latestPlafond.increment('plafond_saat_ini', { by: totalDibayar, transaction });
//                 await latestPlafond.reload();
            
//                 totalDibayar += parseFloat(latestPlafond.plafond_saat_ini);
//                 console.log("Total dibayar: ", totalDibayar);
    
//                 let sisaPlafondUpdate = 0;

//                 const data_pinjaman = await Pinjaman.findOne({ where: { id_pinjaman: antrean.id_pinjaman }, transaction });
//                 if (!data_pinjaman) throw new Error(`Data pinjaman tidak ditemukan untuk id_pinjaman ${antrean.id_pinjaman}`);
                
//                 const jumlah_pinjaman = parseFloat(data_pinjaman.jumlah_pinjaman);
//                 const tanggal_pengajuan = new Date(data_pinjaman.tanggal_pengajuan);
//                 console.log("Jumlah pinjaman: ", jumlah_pinjaman);
//                 console.log("Tanggal pengajuan: ", tanggal_pengajuan);
            
//                 let tanggalPlafondTersedia = new Date();
//                 if (totalDibayar > 0) {
//                     await latestPlafond.update({ plafond_saat_ini: 0, tanggal_plafond_tersedia: tanggalPlafondTersedia }, { transaction });
    
//                     sisaPlafondUpdate = totalDibayar;
//                     console.log("Sisa plafond: ", sisaPlafondUpdate);
//                     console.log("Tanggal plafond tersedia: ", tanggalPlafondTersedia);

//                 }
//                 else if (totalDibayar < jumlah_pinjaman) {
//                     sisaPlafondUpdate = totalDibayar;
//                     const nextMonthDate = new Date();
//                     nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    
//                     let bulan = Math.floor(sisaPlafondUpdate / totalDibayarAwal);
//                     let bulanTambahan = Math.abs(bulan);
//                     console.log("Bulan tambahan: ", bulanTambahan);

//                     let tanggalPlafondTersedia = new Date();

//                     tanggalPlafondTersedia.setMonth(tanggalPlafondTersedia.getMonth() + bulanTambahan);
//                     tanggalPlafondTersedia.setDate(1);
    
//                     console.log("Sisa plafond: ", sisaPlafondUpdate);
    
//                     await latestPlafond.update({ plafond_saat_ini: sisaPlafondUpdate,tanggal_plafond_tersedia: tanggalPlafondTersedia }, { transaction });
//                     console.log("Tanggal plafond tersedia: ", tanggalPlafondTersedia);
//                 }

                
            
//                 // await PlafondUpdate.update(
//                 //     { plafond_saat_ini: plafondAngsuran},
//                 //     { where: { id_plafondupdate: latestPlafond.id_plafondupdate } }
//                 // );
//             }

//             }
//         }

//         // Proses pembaruan data angsuran (jika di Angsuran != null)
//         // for (const item of angsuranDataTerakhir) {
//         //     // console.log("Processing antrean:", antrean.id_pinjaman);
//         //     // console.log("Available id_pinjaman in angsuranDataTerakhir:", angsuranDataTerakhir.map(a => a.id_pinjaman));

//         //     // const item = angsuranDataTerakhir.find(a => a.id_pinjaman === antrean.id_pinjaman);

        
//         //     lastIdNumber++;
//         //     const newId = `A${lastIdNumber.toString().padStart(5, "0")}`;
        
//         //     let potongan = item.AngsuranPinjaman.jumlah_angsuran;
//         //     let itemsudahdibayar = item.sudah_dibayar;

//         //     console.log("Potongan: ", potongan);
//         //     console.log("Item sudah dibayar: ", itemsudahdibayar);

//         //     let sum = potongan + itemsudahdibayar;
//         //     let parts = sum.toString().split(".");
//         //     if (parts.length > 1 && parts[1].length > 2) {
//         //         sum = parseFloat(parts[0] + "." + parts[1].substring(0, 2));
//         //     }

//         //     let sudahDibayarBaru = Math.floor(sum);
//         //     let belumDibayarBaru = Math.max(0, parseFloat((item.belum_dibayar - sudahDibayarBaru).toFixed(2)));
//         //     let statusBaru = belumDibayarBaru <= 0 ? 'Lunas' : item.status;

//         //     console.log("Sudah dibayar baru: ", sudahDibayarBaru);
//         //     console.log("Belum dibayar baru: ", belumDibayarBaru);
            
//         //     await Angsuran.create({
//         //         id_angsuran: newId,
//         //         tanggal_angsuran: formattedToday,
//         //         sudah_dibayar: sudahDibayarBaru,
//         //         belum_dibayar: belumDibayarBaru,
//         //         bulan_angsuran: item.bulan_angsuran + 1,
//         //         status: statusBaru,
//         //         id_peminjam: item.id_peminjam,
//         //         id_pinjaman: item.id_pinjaman,
//         //     });

//         //     let totalDibayar = angsuranDataTerakhir.reduce((sum, data) => sum + parseFloat(data.AngsuranPinjaman.jumlah_angsuran || 0), 0);
//         //     console.log("TotalDibayar: ", totalDibayar); 
//         //     let totalDibayarAwal = totalDibayar;

//         //     // console.log("Antreans: ", antreans);

//         //     for (const antrean of antreans) {
//         //         if (totalDibayar <= 0) break;
//         //         const plafondUpdate = await PlafondUpdate.findOne({ where: { id_pinjaman: antrean.id_pinjaman }, transaction });
//         //         if (!plafondUpdate) {
//         //             throw new Error(`PlafondUpdate tidak ditemukan untuk id_pinjaman ${antrean.id_pinjaman}`);
//         //         }
    
//         //         await plafondUpdate.increment('plafond_saat_ini', { by: totalDibayar, transaction });
//         //         await plafondUpdate.reload();
    
//         //         totalDibayar += parseFloat(plafondUpdate.plafond_saat_ini);
//         //         console.log("Total dibayar +=: ", totalDibayar);
    
//         //         let sisaPlafondUpdate = 0;
    
//         //         const pinjaman = await Pinjaman.findOne({ where: { id_pinjaman: antrean.id_pinjaman }, transaction });
//         //         if (!pinjaman) throw new Error(`Data pinjaman tidak ditemukan untuk id_pinjaman ${antrean.id_pinjaman}`);
                
//         //         const jumlah_pinjaman = parseFloat(pinjaman.jumlah_pinjaman);
//         //         const tanggal_pengajuan = new Date(pinjaman.tanggal_pengajuan);
//         //         console.log("Jumlah pinjaman: ", jumlah_pinjaman);
//         //         console.log("Tanggal pengajuan: ", tanggal_pengajuan);
            
//         //         let tanggalPlafondTersedia = new Date();
//         //         if (totalDibayar > 0) {
//         //             await plafondUpdate.update({ plafond_saat_ini: 0, tanggal_plafond_tersedia: tanggalPlafondTersedia }, { transaction });
    
//         //             sisaPlafondUpdate = totalDibayar;
//         //             console.log("Sisa plafond: ", sisaPlafondUpdate);
//         //             console.log("Tanggal plafond tersedia: ", tanggalPlafondTersedia);

//         //         }
//         //         else if (totalDibayar < jumlah_pinjaman) {
//         //             sisaPlafondUpdate = totalDibayar;
//         //             const nextMonthDate = new Date();
//         //             nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    
//         //             let bulan = Math.floor(sisaPlafondUpdate / totalDibayarAwal);
//         //             let bulanTambahan = Math.abs(bulan);
//         //             console.log("Bulan tambahan: ", bulanTambahan);

//         //             let tanggalPlafondTersedia = new Date();

//         //             tanggalPlafondTersedia.setMonth(tanggalPlafondTersedia.getMonth() + bulanTambahan);
//         //             tanggalPlafondTersedia.setDate(1);
    
//         //             console.log("Sisa plafond: ", sisaPlafondUpdate);
    
//         //             await plafondUpdate.update({ plafond_saat_ini: sisaPlafondUpdate,tanggal_plafond_tersedia: tanggalPlafondTersedia }, { transaction });
//         //             console.log("Tanggal plafond tersedia: ", tanggalPlafondTersedia);
//         //         }
//         //     }

//         // }
        
//         await transaction.commit();
//         console.log("Update angsuran OTOMATIS berhasil.");

//         await Angsuran.update(
//             { sudah_dihitung: true },
//             { where: { sudah_dihitung: false } },
//         );
//     } catch (error) {
//         await transaction.rollback();
//         console.error("Error updating angsuran:", error.message, error.stack);
        
//     }
// };

// alur update angsuran otomatis berdsasarkan plafond update terakhir yg status transfer = Selesai 

//Fix 

const updateAngsuranOtomatis = async () => {
    const transaction = await db.transaction();
    try {
        const today = new Date();
        const formattedToday = today.toISOString().split("T")[0];
        const dayOfMonth = today.getDate();

        if (dayOfMonth !== 18) {
            console.log("Update angsuran otomatis hanya dijalankan pada tanggal 18.");
            return;
        }

        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        const excludedPinjamanIds = await Pinjaman.findAll({
            where: {
                tanggal_pengajuan: {
                    [Op.gte]: thisMonthStart,
                    [Op.lt]: nextMonthStart,
                },
                [Op.and]: Sequelize.where(
                    Sequelize.fn("DATE", Sequelize.col("tanggal_pengajuan")),
                    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-1`
                ),
            },
            attributes: ["id_pinjaman"],
        }).then((data) => data.map((item) => item.id_pinjaman));


        const existingUpdate = await Angsuran.findOne({
            where: {
                tanggal_angsuran: {
                    [Op.gte]: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-1`,
                },
            },
        });

        if (existingUpdate) {
            console.log("Angsuran sudah diperbarui bulan ini.");
            return;
        }


        // Ambil plafond terakhir
        const plafondTerakhir = await PlafondUpdate.findOne({
            include: [
                {
                    model: Pinjaman,
                    as: "UpdatePinjamanPlafond",
                    attributes: ["status_pengajuan", "status_transfer"],
                    where: { status_pengajuan: "Diterima", status_transfer: "Selesai" },
                },
            ],
            attributes: ["id_pinjaman", "plafond_saat_ini"],
            order: [["id_pinjaman", "DESC"]],
            raw: true,
        });

        if (!plafondTerakhir) {
            console.log("Data plafond terakhir tidak ditemukan.");
            return;
        }

        console.log("Plafond terakhir sebelum update: ", plafondTerakhir.plafond_saat_ini);

         // Menghitung total angsuran yang harus dibayar dari Pinjaman
         const totalAngsuranHarusDibayar = await Pinjaman.sum("jumlah_angsuran", {
            where: {
                status_pelunasan: { [Op.ne]: "Lunas" },
                status_pengajuan: { [Op.notIn]: ["Ditunda", "Dibatalkan"] },
                status_transfer: { [Op.notIn]: ["Belum Ditransfer", "Dibatalkan"] },
            },
        });

        console.log("Total angsuran yang harus dibayar: ", totalAngsuranHarusDibayar);

        
        // Menambahkan total angsuran masuk ke plafond baru
        let plafondBaru = parseFloat(plafondTerakhir.plafond_saat_ini || 0) + totalAngsuranHarusDibayar;

        console.log("Plafond baru : ", plafondBaru);

        let plafondBaruAwal = plafondBaru;

        await PlafondUpdate.update(
            { plafond_saat_ini: plafondBaru },
            { where: { id_pinjaman: plafondTerakhir.id_pinjaman }, transaction }
        );

        console.log("Plafond setelah angsuran masuk: ", plafondBaru);

        let antreans = await AntreanPengajuan.findAll({
            attributes: ['nomor_antrean', 'id_pinjaman'],
            order: [['nomor_antrean', 'ASC']],
        });

        // Simpan data angsuran baru ke tabel Angsuran
        const lastAngsuran = await Angsuran.findAll({
            attributes: [
                "id_pinjaman",
                [ Sequelize.fn("MAX", Sequelize.col("id_angsuran")), "latest_id_angsuran"],
            ],
            group: ["id_pinjaman"],
            raw: true,
        })
        // let lastIdNumber = lastAngsuran ? parseInt(lastAngsuran.id_angsuran.substring(1), 10) : 0;

        let lastIdNumber = 0;
        const lastRecord = await Angsuran.findOne({ order: [["id_angsuran", "DESC"]] });
        if (lastRecord && lastRecord.id_angsuran) {
            lastIdNumber = parseInt(lastRecord.id_angsuran.substring(1), 10);
        }

        console.log("Last angsuran: ", lastAngsuran);
        const angsuranData = await Angsuran.findAll({
            where: {
                id_angsuran: {
                    [Op.in]: lastAngsuran.map(data => data.latest_id_angsuran)
                }
            },
            include: [
                {
                    model: Pinjaman,
                    as: 'AngsuranPinjaman',
                    attributes: ['pinjaman_setelah_pembulatan', 'status_pelunasan', 'jumlah_angsuran', 'jumlah_pinjaman'],
                    where: {
                        status_pelunasan: {
                            [Op.ne]: 'Lunas',
                        },
                        id_pinjaman: {
                            [Op.notIn]: excludedPinjamanIds,
                        }
                    },
                },
            ],
            where: {
                belum_dibayar: {
                    [Op.gt]: 0, //operator greater than
                },
                bulan_angsuran: {
                    [Op.lt]: 60, //operator less than
                },
            },
            order: [["id_pinjaman", "ASC"], ["id_angsuran", "DESC"]],
        });

        console.log("Angsuran data: ", angsuranData);

        const result = {};
        angsuranData.forEach((item) => {
        if (!result[item.id_pinjaman]) {
            result[item.id_pinjaman] = item;
        }
        });

        const angsuranDataTerakhir = Object.values(result);


        const angsuranPertama = await Pinjaman.findAll({
            where: {
                status_pelunasan: {
                    [Op.ne]: 'Lunas',
                },
                status_pengajuan: {
                    [Op.notIn]: ['Ditunda', 'Dibatalkan'],
                },
                status_transfer: {
                    [Op.notIn]: ['Belum Ditransfer', 'Dibatalkan'],
                },
            },
            attributes: ['id_pinjaman', 'jumlah_angsuran', 'pinjaman_setelah_pembulatan', 'id_peminjam', 'jumlah_pinjaman'],
        });

        console.log("Angsuran pertama: ", angsuranPertama);

        //otomatisasi angsuran jika Angsuran = null
        // for (const item of angsuranPertama) {
        //     const existingAngsuranPertama = await Angsuran.findOne({
        //     where: {
        //             id_pinjaman: item.id_pinjaman,
        //             bulan_angsuran: 1,
        //         },
        //     });

        //     if (!existingAngsuranPertama) { 
        //         lastIdNumber++;
        //         const newId = `A${lastIdNumber.toString().padStart(5, "0")}`;
                
        //         const jumlahAngsuran = item.jumlah_angsuran;
        //         const jumlahPinjaman = item.jumlah_pinjaman;
        //         let sudahDibayar = item.sudah_dibayar;

        //         const belumDibayar = parseFloat((item.pinjaman_setelah_pembulatan - jumlahAngsuran).toFixed(2));
        //         const statusBaru = belumDibayar <= 0 ? 'Lunas' : 'Belum Lunas';
        //         const peminjam = item.id_peminjam;

        //         await Angsuran.create({
        //             id_angsuran: newId,
        //             tanggal_angsuran: formattedToday,
        //             sudah_dibayar: jumlahAngsuran,
        //             belum_dibayar: Math.max(0, belumDibayar),
        //             bulan_angsuran: 1,
        //             status: statusBaru,
        //             id_peminjam: peminjam,
        //             id_pinjaman: item.id_pinjaman,
        //         });

        //         if (statusBaru === 'Lunas') {
        //             await Pinjaman.update(
        //                 { status_pelunasan: 'Lunas' },
        //                 { where: { id_pinjaman: item.id_pinjaman } }
        //             );
        //         }

        //         // let totalDibayar = angsuranPertama.reduce((sum, data) => sum - parseFloat(data.jumlah_pinjaman || 0), 0);
        //         // let totalDibayarAwal = totalDibayar;
        //         // console.log("Total dibayar: ", totalDibayar);

        //         // kalau tidak ada antrean tidak pakai ini

        //         if (antreans.length === 0) return;

        //         const antreanData = await Pinjaman.findAll({
        //             where: {
        //                 id_pinjaman: {
        //                     [Op.in]: antreans.map(antrean => antrean.id_pinjaman),
        //                 },
        //             },
        //             attributes: ['id_pinjaman', 'jumlah_pinjaman'],
        //             transaction,
        //         });

        //         const pinjamanMap = new Map(antreanData.map(item => [item.id_pinjaman, item.jumlah_pinjaman]));

        //         let plafondSaatIni = plafondBaru;

        //         for (let i = 0; i < antreans.length; i++) {
        //             const antrean = antreans[i];
        //             const jumlahPinjamanAntrean = pinjamanMap.get(antrean.id_pinjaman) || 0;
                
        //             // Kurangi plafond_saat_ini untuk antrean berikutnya
        //             plafondSaatIni = parseFloat((plafondSaatIni - jumlahPinjamanAntrean).toFixed(2));
        //             // plafondSaatIni -= jumlahPinjamanAntrean;
        //             // plafondSaatIni = parseFloat(plafondSaatIni.toFixed(2)); // Pastikan tetap dalam 2 desimal


        //             // Update plafond_saat_ini untuk antrean saat ini
        //             if (plafondSaatIni > 0) {
        //                 let tanggalPlafondTersedia = new Date();
        //                 await PlafondUpdate.update(
        //                     {
        //                         plafond_saat_ini: plafondSaatIni,
        //                         tanggal_plafond_tersedia: tanggalPlafondTersedia,
        //                     },
        //                     { 
        //                         where: { id_pinjaman: antrean.id_pinjaman },
        //                         transaction,
        //                     }
        //                 );
        //             } else if (plafondSaatIni < jumlahPinjamanAntrean) {
        //                 const nextMonthDate = new Date();
        //                 nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

        //                 let bulan = Math.floor(plafondSaatIni / totalAngsuranHarusDibayar);
        //                 let bulanTambahan = Math.abs(bulan);
        //                 console.log("Plafond saat ini: ", plafondSaatIni);
        //                 console.log("Plafond baru: ", totalAngsuranHarusDibayar);
        //                 console.log("Bulan tambahan: ", bulanTambahan);
        //                 let tanggalPlafondTersedia = new Date();

        //                 tanggalPlafondTersedia.setMonth(tanggalPlafondTersedia.getMonth() + bulanTambahan);
        //                 tanggalPlafondTersedia.setDate(1);

        //                 await PlafondUpdate.update(
        //                     {
        //                         plafond_saat_ini: plafondSaatIni,
        //                         tanggal_plafond_tersedia: tanggalPlafondTersedia,
        //                     },
        //                     { 
        //                         where: { id_pinjaman: antrean.id_pinjaman },
        //                         transaction,
        //                     }
        //                 );
                            
        //             }
                
                  
        //         }
                
                    
        //     }
        // }

        for (const item of angsuranPertama) {
            const existingAngsuranPertama = await Angsuran.findOne({
                where: { id_pinjaman: item.id_pinjaman, bulan_angsuran: 1 },
            });

            if (!existingAngsuranPertama) {
                lastIdNumber++;
                const newId = `A${lastIdNumber.toString().padStart(5, "0")}`;

                const jumlahAngsuran = item.jumlah_angsuran;
                const belumDibayar = parseFloat((item.pinjaman_setelah_pembulatan - jumlahAngsuran).toFixed(2));
                const statusBaru = belumDibayar <= 0 ? "Lunas" : "Belum Lunas";

                await Angsuran.create({
                    id_angsuran: newId,
                    tanggal_angsuran: formattedToday,
                    sudah_dibayar: jumlahAngsuran,
                    belum_dibayar: Math.max(0, belumDibayar),
                    bulan_angsuran: 1,
                    status: statusBaru,
                    id_peminjam: item.id_peminjam,
                    id_pinjaman: item.id_pinjaman,
                });

                if (statusBaru === "Lunas") {
                    await Pinjaman.update(
                        { status_pelunasan: "Lunas" },
                        { where: { id_pinjaman: item.id_pinjaman } }
                    );
                }
            }
        }

        // Jika ada antrean, lanjut proses antrean
        if (antreans.length > 0) {
            const antreanData = await Pinjaman.findAll({
                where: {
                    id_pinjaman: {
                        [Op.in]: antreans.map((antrean) => antrean.id_pinjaman),
                    },
                },
                attributes: ["id_pinjaman", "jumlah_pinjaman"],
                transaction,
            });

            const pinjamanMap = new Map(antreanData.map((item) => [item.id_pinjaman, item.jumlah_pinjaman]));
            let plafondSaatIni = plafondBaru;

            for (let i = 0; i < antreans.length; i++) {
                const antrean = antreans[i];
                const jumlahPinjamanAntrean = pinjamanMap.get(antrean.id_pinjaman) || 0;

                // Kurangi plafond_saat_ini untuk antrean berikutnya
                plafondSaatIni = parseFloat((plafondSaatIni - jumlahPinjamanAntrean).toFixed(2));

                if (plafondSaatIni > 0) {
                    let tanggalPlafondTersedia = new Date();
                    await PlafondUpdate.update(
                        {
                            plafond_saat_ini: plafondSaatIni,
                            tanggal_plafond_tersedia: tanggalPlafondTersedia,
                        },
                        { where: { id_pinjaman: antrean.id_pinjaman }, transaction }
                    );
                } else if (plafondSaatIni < jumlahPinjamanAntrean) {
                    const nextMonthDate = new Date();
                    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

                    let bulanTambahan = Math.abs(Math.floor(plafondSaatIni / totalAngsuranHarusDibayar));
                    let tanggalPlafondTersedia = new Date();
                    tanggalPlafondTersedia.setMonth(tanggalPlafondTersedia.getMonth() + bulanTambahan);
                    tanggalPlafondTersedia.setDate(1);

                    await PlafondUpdate.update(
                        {
                            plafond_saat_ini: plafondSaatIni,
                            tanggal_plafond_tersedia: tanggalPlafondTersedia,
                        },
                        { where: { id_pinjaman: antrean.id_pinjaman }, transaction }
                    );
                }
            }
        }

        //otomatisasi angsuran jika Angsuran != null
        for (const item of angsuranDataTerakhir) {
            lastIdNumber++;
            const newId = `A${lastIdNumber.toString().padStart(5, "0")}`;

                const jumlahAngsuran = item.AngsuranPinjaman.jumlah_angsuran;
                const jumlahPinjaman = item.jumlah_pinjaman;
                let sudahDibayar = item.sudah_dibayar;

                const belumDibayar = parseFloat((item.belum_dibayar - jumlahAngsuran).toFixed(2));
                const statusBaru = belumDibayar <= 0 ? 'Lunas' : 'Belum Lunas';
                const peminjam = item.id_peminjam;

                await Angsuran.create({
                    id_angsuran: newId,
                    tanggal_angsuran: formattedToday,
                    sudah_dibayar: jumlahAngsuran,
                    belum_dibayar: Math.max(0, belumDibayar),
                    bulan_angsuran: item.bulan_angsuran + 1,
                    status: statusBaru,
                    id_peminjam: peminjam,
                    id_pinjaman: item.id_pinjaman,
                });

                if (statusBaru === 'Lunas') {
                    await Pinjaman.update(
                        { status_pelunasan: 'Lunas' },
                        { where: { id_pinjaman: item.id_pinjaman } }
                    );
                }

                // let totalDibayar = angsuranPertama.reduce((sum, data) => sum - parseFloat(data.jumlah_pinjaman || 0), 0);
                // let totalDibayarAwal = totalDibayar;
                // console.log("Total dibayar: ", totalDibayar);

                
                let antreans = await AntreanPengajuan.findAll({
                    attributes: ['nomor_antrean', 'id_pinjaman'],
                    order: [['nomor_antrean', 'ASC']],
                });

                if (antreans.length === 0) return;

                const antreanData = await Pinjaman.findAll({
                    where: {
                        id_pinjaman: {
                            [Op.in]: antreans.map(antrean => antrean.id_pinjaman),
                        },
                    },
                    attributes: ['id_pinjaman', 'jumlah_pinjaman'],
                    transaction,
                });

                const pinjamanMap = new Map(antreanData.map(item => [item.id_pinjaman, item.jumlah_pinjaman]));

                let plafondSaatIni = plafondBaru;

                for (let i = 0; i < antreans.length; i++) {
                    const antrean = antreans[i];
                    const jumlahPinjamanAntrean = pinjamanMap.get(antrean.id_pinjaman) || 0;
                
                    // Kurangi plafond_saat_ini untuk antrean berikutnya
                    plafondSaatIni = parseFloat((plafondSaatIni - jumlahPinjamanAntrean).toFixed(2));
                    // plafondSaatIni -= jumlahPinjamanAntrean;
                    // plafondSaatIni = parseFloat(plafondSaatIni.toFixed(2)); // Pastikan tetap dalam 2 desimal


                    // Update plafond_saat_ini untuk antrean saat ini

                    if (plafondSaatIni > 0) {
                        let tanggalPlafondTersedia = new Date();
                        await PlafondUpdate.update(
                            {
                                plafond_saat_ini: plafondSaatIni,
                                tanggal_plafond_tersedia: tanggalPlafondTersedia,
                            },
                            { 
                                where: { id_pinjaman: antrean.id_pinjaman },
                                transaction,
                            }
                        );
                    } else if (plafondSaatIni < jumlahPinjamanAntrean) {
                        const nextMonthDate = new Date();
                        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

                        let bulan = Math.floor(plafondSaatIni / totalAngsuranHarusDibayar);
                        let bulanTambahan = Math.abs(bulan);
                        console.log("Plafond saat ini: ", plafondSaatIni);
                        console.log("Plafond baru: ", totalAngsuranHarusDibayar);
                        console.log("Bulan tambahan: ", bulanTambahan);
                        let tanggalPlafondTersedia = new Date();

                        tanggalPlafondTersedia.setMonth(tanggalPlafondTersedia.getMonth() + bulanTambahan);
                        tanggalPlafondTersedia.setDate(1);

                        await PlafondUpdate.update(
                            {
                                plafond_saat_ini: plafondSaatIni,
                                tanggal_plafond_tersedia: tanggalPlafondTersedia,
                            },
                            { 
                                where: { id_pinjaman: antrean.id_pinjaman },
                                transaction,
                            }
                        );
                            
                    }
                    
                
                  
                }
        }


        await transaction.commit();
        console.log("Update angsuran otomatis selesai.");

        await Angsuran.update(
            { sudah_dihitung: true },
            { where: { sudah_dihitung: false } },
        );
    } catch (error) {
        await transaction.rollback();
        console.error("Terjadi kesalahan: ", error);
    }
};


export default updateAngsuranOtomatis;
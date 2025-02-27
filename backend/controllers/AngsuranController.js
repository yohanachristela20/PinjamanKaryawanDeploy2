import Pinjaman from "../models/PinjamanModel.js";
import Karyawan from '../models/KaryawanModel.js';
import Angsuran from "../models/AngsuranModel.js";
import PlafondUpdate from "../models/PlafondUpdateModel.js";
import AntreanPengajuan from "../models/AntreanPengajuanModel.js";
import db from "../config/database.js";
import { Sequelize, Op, where } from "sequelize";

export const getAngsuran = async(req, res) => {
    try {
        const response = await Angsuran.findAll();
        res.status(200).json(response); 
    } catch (error) {
        console.log(error.message); 
    }
}

export const getAngsuranById = async(req, res) => {
    try {
        const response = await Angsuran.findOne({
            where:{
                id_angsuran: req.params.id_angsuran 
            }
        });
        res.status(200).json(response); 
    } catch (error) {
        console.log(error.message); 
    }
}

// export const createAngsuran = async(req, res) => {
//     try {
//         console.log(req.body);
//         await Angsuran.create(req.body);
//         res.status(201).json({msg: "Data Angsuran baru telah dibuat"}); 
//     } catch (error) {
//         res.status(500).json({message: error.message}); 
//     }
// }


export const createAngsuran = async (req, res) => {
    const transaction = await db.transaction();
    try {
        const { sudah_dibayar, jumlah_pinjaman } = req.body;
        let sisaPlafond = parseFloat(sudah_dibayar);
        let jumlahPinjaman = parseFloat(jumlah_pinjaman);
        let tanggalAngsuran = new Date();
        let sisaPlafondUpdate = 0;
        const newAngsuran = await Angsuran.create(req.body, { transaction });

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

        const totalAngsuranHarusDibayar = await Pinjaman.sum("jumlah_angsuran", {
            where: {
                status_pelunasan: { [Op.ne]: "Lunas" },
                status_pengajuan: { [Op.notIn]: ["Ditunda", "Dibatalkan"] },
                status_transfer: { [Op.notIn]: ["Belum Ditransfer", "Dibatalkan"] },
            },
        });

        console.log("Total angsuran yang harus dibayar: ", totalAngsuranHarusDibayar);

        let plafondBaru = parseFloat(plafondTerakhir.plafond_saat_ini || 0) + sisaPlafond;
        console.log("Plafond baru: ", plafondBaru);
        console.log("Plafond terakhir: ", plafondTerakhir.plafond_saat_ini);
        console.log("Sisa plafond sudah dibayar: ", sisaPlafond);

        await PlafondUpdate.update(
            { plafond_saat_ini: plafondBaru },
            { where: { id_pinjaman: plafondTerakhir.id_pinjaman }, transaction }
        );

        let antreans = await AntreanPengajuan.findAll({
            attributes: ['nomor_antrean', 'id_pinjaman'],
            order: [['nomor_antrean', 'ASC']],
        });

        if (antreans.length === 0) return;

        console.log("Antreans: ", antreans);

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

        // Loop untuk mengelola antrean 1 hingga z
        for (let i = 0; i < antreans.length; i++) {
            const antrean = antreans[i];
            const jumlahPinjamanAntrean = pinjamanMap.get(antrean.id_pinjaman) || 0;
        
            // Kurangi plafond_saat_ini untuk antrean berikutnya
            plafondSaatIni = parseFloat((plafondSaatIni - jumlahPinjamanAntrean).toFixed(2));


            // Update plafond_saat_ini untuk antrean saat ini
            if (plafondSaatIni > 0) {
                let today = new Date();
                let formattedToday = today.toISOString().split("T")[0]; 
                await PlafondUpdate.update(
                    {
                        plafond_saat_ini: plafondSaatIni,
                        tanggal_plafond_tersedia: formattedToday,
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
                console.log("Plafond sudah dibayar: ", totalAngsuranHarusDibayar);
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
        await transaction.commit();
        res.status(201).json({
            msg: "Data Angsuran baru dibuat dan PlafondUpdate diperbarui",
            data: { newAngsuran, antreans }
        });
    } catch (error) {
        await transaction.rollback();
        console.error("Error:", error.message);
        res.status(500).json({ message: error.message });
    }
};

export const updateAngsuran = async(req, res) => {
    try {
        // console.log(req.body);
        await Angsuran.update(req.body, {
            where:{
                id_angsuran: req.params.id_angsuran
            }
        });
        res.status(200).json({msg: "Data Angsuran berhasil diperbarui"}); 
    } catch (error) {
        res.status(500).json({message: error.message}); 
    }
}


export const getKaryawanData = async (req, res) => {
    try {
        const karyawanData = await Angsuran.findAll({
            include: [
                {
                    model: Pinjaman,
                    as: 'AngsuranPinjaman',
                    attributes: ['jumlah_angsuran'],
                },
                {
                    model: Karyawan,
                    as: 'KaryawanPeminjam',
                    attributes: ['nama'],
                }
            ],
        });
        console.log(karyawanData); 
        res.status(200).json(karyawanData);
    } catch (error) {
        console.error("Error fetching data:", error.message);
        console.error(error.stack);
        res.status(500).json({ message: "Internal Server Error" });
    }
};



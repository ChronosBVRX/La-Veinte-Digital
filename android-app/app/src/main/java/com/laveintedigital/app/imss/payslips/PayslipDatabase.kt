package com.laveintedigital.app.imss.payslips

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Delete
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Entity(tableName = "payslip_documents")
data class PayslipDocument(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val source: String,
    val displayName: String,
    val localPath: String,
    val downloadedAt: Long = System.currentTimeMillis(),
    val fileSize: Long = 0,
    val sha256: String = "",
    val mimeType: String = "application/pdf",
    val periodLabel: String? = null,
    val conceptsPath: String? = null,
    val sourceHost: String? = null,
)

@Dao
interface PayslipDao {
    @Query("SELECT * FROM payslip_documents ORDER BY downloadedAt DESC")
    suspend fun getAll(): List<PayslipDocument>

    @Query("SELECT * FROM payslip_documents WHERE sha256 = :hash LIMIT 1")
    suspend fun findByHash(hash: String): PayslipDocument?

    @Query("SELECT COUNT(*) FROM payslip_documents")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(doc: PayslipDocument): Long

    @Delete
    suspend fun delete(doc: PayslipDocument)

    @Query("UPDATE payslip_documents SET conceptsPath = :path WHERE id = :id")
    suspend fun updateConceptsPath(id: Long, path: String)
}

@Database(entities = [PayslipDocument::class], version = 2, exportSchema = false)
abstract class PayslipDatabase : RoomDatabase() {
    abstract fun payslipDao(): PayslipDao

    companion object {
        @Volatile private var INSTANCE: PayslipDatabase? = null

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE payslip_documents ADD COLUMN conceptsPath TEXT DEFAULT NULL")
            }
        }

        fun getInstance(context: Context): PayslipDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    PayslipDatabase::class.java,
                    "laveinte_payslips.db"
                ).addMigrations(MIGRATION_1_2).build().also { INSTANCE = it }
            }
        }
    }
}

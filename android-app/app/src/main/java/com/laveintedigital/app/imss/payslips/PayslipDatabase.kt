package com.laveintedigital.app.imss.payslips

import android.content.Context
import android.util.Log
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Delete
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import java.io.File

@Entity(
    tableName = "payslip_documents",
    indices = [
        Index(value = ["sha256"], unique = true)
    ]
)
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
    /**
     * Propietario lógico del documento (p. ej. user id de Supabase informado por la web).
     * NULL = documento legacy sin atribución: se muestra a todo usuario del dispositivo
     * (política conservadora documentada en docs/ANDROID_OFFLINE_DOCUMENTS.md; nunca se
     * borra ni se oculta por una migración).
     */
    val ownerId: String? = null,
    /**
     * Clave externa estable para documentos generados por la web (p. ej. id del escrito).
     * Permite actualizar la copia nativa sin duplicar filas cuando el contenido cambia.
     */
    val externalKey: String? = null,
)

@Dao
interface PayslipDao {
    @Query("SELECT * FROM payslip_documents ORDER BY downloadedAt DESC")
    suspend fun getAll(): List<PayslipDocument>

    @Query("SELECT * FROM payslip_documents WHERE id = :id LIMIT 1")
    suspend fun findById(id: Long): PayslipDocument?

    @Query("SELECT * FROM payslip_documents WHERE sha256 = :hash LIMIT 1")
    suspend fun findByHash(hash: String): PayslipDocument?

    @Query("SELECT * FROM payslip_documents WHERE source = :source AND externalKey = :key LIMIT 1")
    suspend fun findByExternalKey(source: String, key: String): PayslipDocument?

    @Query("SELECT * FROM payslip_documents WHERE source = :source AND externalKey = :key")
    suspend fun findAllByExternalKey(source: String, key: String): List<PayslipDocument>

    @Query("SELECT COUNT(*) FROM payslip_documents")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(doc: PayslipDocument): Long

    @Delete
    suspend fun delete(doc: PayslipDocument)

    @Query("DELETE FROM payslip_documents WHERE id = :id")
    suspend fun deleteById(id: Long): Int

    @Query("UPDATE payslip_documents SET conceptsPath = :path WHERE id = :id")
    suspend fun updateConceptsPath(id: Long, path: String)
}

@Database(entities = [PayslipDocument::class], version = 4, exportSchema = false)
abstract class PayslipDatabase : RoomDatabase() {
    abstract fun payslipDao(): PayslipDao

    companion object {
        private const val TAG = "PayslipDatabase"
        @Volatile private var INSTANCE: PayslipDatabase? = null

        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE payslip_documents ADD COLUMN conceptsPath TEXT DEFAULT NULL")
            }
        }

        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // 1. Asignar un hash sintético a registros con sha256 vacío antes de crear índice único
                db.execSQL("UPDATE payslip_documents SET sha256 = 'legacy_unhashed_' || id WHERE sha256 IS NULL OR trim(sha256) = ''")

                // 2. Deduplicar filas por sha256 conservando el registro canónico prioritario:
                //    - Prioridad 1: No es 'blob_%'
                //    - Prioridad 2: Tiene periodLabel válido
                //    - Prioridad 3: Tiene conceptsPath
                //    - Prioridad 4: ID menor (más antiguo/estable)
                db.execSQL("""
                    DELETE FROM payslip_documents
                    WHERE id NOT IN (
                        SELECT id FROM (
                            SELECT id,
                                   ROW_NUMBER() OVER (
                                       PARTITION BY sha256
                                       ORDER BY
                                           CASE WHEN displayName LIKE 'blob_%' THEN 1 ELSE 0 END ASC,
                                           CASE WHEN periodLabel IS NOT NULL AND trim(periodLabel) != '' THEN 0 ELSE 1 END ASC,
                                           CASE WHEN conceptsPath IS NOT NULL AND trim(conceptsPath) != '' THEN 0 ELSE 1 END ASC,
                                           id ASC
                                   ) as rn
                            FROM payslip_documents
                            WHERE sha256 IS NOT NULL AND trim(sha256) != ''
                        ) WHERE rn = 1
                    ) AND sha256 IS NOT NULL AND trim(sha256) != ''
                """.trimIndent())

                // 3. Crear el índice único de sha256
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_payslip_documents_sha256` ON `payslip_documents` (`sha256`)")
            }
        }

        /**
         * Migración 3 → 4 (modo offline): agrega atribución de propietario y clave externa.
         * Estrictamente aditiva: columnas NULL por defecto, sin borrar ni reescribir filas.
         * Instalaciones existentes conservan todos sus tarjetones/checadas (ownerId NULL =
         * legacy, visible según la política documentada).
         */
        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE payslip_documents ADD COLUMN ownerId TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE payslip_documents ADD COLUMN externalKey TEXT DEFAULT NULL")
            }
        }

        fun getInstance(context: Context): PayslipDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    PayslipDatabase::class.java,
                    "laveinte_payslips.db"
                )
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4)
                    .build()
                    .also {
                        INSTANCE = it
                    }
            }
        }

        /**
         * Reparación segura e idempotente de registros 'blob_...'.
         *
         * - Si un registro 'blob_' tiene el mismo hash o archivo que un tarjetón canónico,
         *   elimina la fila redundante y su archivo sobrante.
         * - Si un registro 'blob_' es el archivo de conceptos de un tarjetón, lo asocia a su
         *   tarjetón correspondiente vía `conceptsPath` y remueve la fila independiente.
         * - Si es un PDF único no duplicado, lo conserva.
         */
        suspend fun repairLegacyBlobRecords(context: Context) {
            try {
                val db = getInstance(context)
                val all = db.payslipDao().getAll()
                val (blobDocs, canonicalDocs) = all.partition { it.displayName.startsWith("blob_") }
                if (blobDocs.isEmpty()) return

                for (blob in blobDocs) {
                    val blobFile = File(blob.localPath)

                    // Caso A: Mismo SHA-256 que un documento canónico
                    val canonicalMatch = canonicalDocs.firstOrNull { it.sha256.isNotBlank() && it.sha256 == blob.sha256 && it.id != blob.id }
                    if (canonicalMatch != null) {
                        Log.i(TAG, "REPAIR_BLOB_DUPLICATE: eliminando fila blob #${blob.id} idCanónico=${canonicalMatch.id}")
                        db.payslipDao().delete(blob)
                        if (blobFile.exists() && blobFile.absolutePath != canonicalMatch.localPath && blobFile.absolutePath != canonicalMatch.conceptsPath) {
                            runCatching { blobFile.delete() }
                        }
                        continue
                    }

                    // Caso B: El archivo coincide con el conceptsPath de algún tarjetón
                    val isConceptsOfOther = canonicalDocs.any { it.conceptsPath == blob.localPath }
                    if (isConceptsOfOther) {
                        Log.i(TAG, "REPAIR_BLOB_CONCEPTS: eliminando fila independiente blob #${blob.id} ya asociada como conceptos")
                        db.payslipDao().delete(blob)
                        continue
                    }

                    // Caso C: Archivo ya no existe en disco
                    if (!blobFile.exists() || blobFile.length() == 0L) {
                        Log.i(TAG, "REPAIR_BLOB_ORPHAN: eliminando fila sin archivo físico #${blob.id}")
                        db.payslipDao().delete(blob)
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "repairLegacyBlobRecords failed", e)
            }
        }
    }
}

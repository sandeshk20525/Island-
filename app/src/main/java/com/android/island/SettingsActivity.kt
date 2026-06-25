package com.android.island

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.widget.EditText
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Switch
import android.view.Gravity
import android.view.View

/**
 * Companion Settings UI App for Dynamic Island custom positions, colors, and package blacklisting.
 */
class SettingsActivity : Activity() {

    private lateinit var prefs: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Use Device Protected Storage Context so LSPosed/Xposed can read the preference files
        val safeContext = try {
            createDeviceProtectedStorageContext()
        } catch (e: Exception) {
            this
        }
        
        prefs = safeContext.getSharedPreferences("island_settings", Context.MODE_PRIVATE)

        // Root programmatic container
        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#121212")) // Dark theme
            setPadding(48, 48, 48, 48)
            gravity = Gravity.TOP
        }

        val titleView = TextView(this).apply {
            text = "🌴 Island Settings"
            setTextColor(Color.WHITE)
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 48
            }
        }
        rootLayout.addView(titleView)

        // Card helper function
        fun createCardSection(title: String, child: View): LinearLayout {
            val container = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(32, 32, 32, 32)
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#1E1E1E"))
                    cornerRadius = 16f
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = 32
                }
            }
            val secTitle = TextView(this).apply {
                text = title
                setTextColor(Color.parseColor("#10B981")) // Emerald color
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = 16
                }
            }
            container.addView(secTitle)
            container.addView(child)
            return container
        }

        // X Offset Section
        val xLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val xLabel = TextView(this).apply {
            text = "Current X Offset: ${prefs.getInt("island_x_offset", 0)} px"
            setTextColor(Color.parseColor("#9CA3AF"))
            textSize = 14f
        }
        val xSeekBar = SeekBar(this).apply {
            max = 200
            progress = prefs.getInt("island_x_offset", 0) + 100 // mapped [-100, 100]
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    val actualVal = progress - 100
                    xLabel.text = "Current X Offset: ${actualVal} px"
                }
                override fun onStartTrackingTouch(seekBar: SeekBar?) {}
                override fun onStopTrackingTouch(seekBar: SeekBar?) {}
            })
        }
        xLayout.addView(xSeekBar)
        xLayout.addView(xLabel)
        rootLayout.addView(createCardSection("Horizontal position (X-offset)", xLayout))

        // Y Offset Section
        val yLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val yLabel = TextView(this).apply {
            text = "Current Y Offset: ${prefs.getInt("island_y_offset", 0)} px"
            setTextColor(Color.parseColor("#9CA3AF"))
            textSize = 14f
        }
        val ySeekBar = SeekBar(this).apply {
            max = 200
            progress = prefs.getInt("island_y_offset", 0) + 100 // mapped [-100, 100]
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    val actualVal = progress - 100
                    yLabel.text = "Current Y Offset: ${actualVal} px"
                }
                override fun onStartTrackingTouch(seekBar: SeekBar?) {}
                override fun onStopTrackingTouch(seekBar: SeekBar?) {}
            })
        }
        yLayout.addView(ySeekBar)
        yLayout.addView(yLabel)
        rootLayout.addView(createCardSection("Vertical position (Y-offset)", yLayout))

        // Material You (Monet) Dynamic Coloring Section
        val monetLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val monetSwitch = Switch(this).apply {
            text = "Enable Material You (Monet) coloring"
            setTextColor(Color.WHITE)
            textSize = 14f
            isChecked = prefs.getBoolean("use_monet", true)
        }
        monetLayout.addView(monetSwitch)
        rootLayout.addView(createCardSection("Material You / Dynamic Theme", monetLayout))

        // Landscape & Orientation Handling Section
        val landscapeLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val landscapeSwitch = Switch(this).apply {
            text = "Hide Island in Landscape mode"
            setTextColor(Color.WHITE)
            textSize = 14f
            isChecked = prefs.getBoolean("hide_on_landscape", true)
        }
        val landscapeDesc = TextView(this).apply {
            text = "Hides the island view entirely during landscape orientation to avoid interrupting gaming or movies. If disabled, island shifts to the top edge center of landscape mode."
            setTextColor(Color.parseColor("#9CA3AF"))
            textSize = 11f
            setPadding(0, 8, 0, 0)
        }
        landscapeLayout.addView(landscapeSwitch)
        landscapeLayout.addView(landscapeDesc)
        rootLayout.addView(createCardSection("Landscape & Orientation Handling", landscapeLayout))

        // Island Color Section
        val colorInput = EditText(this).apply {
            setText(prefs.getString("island_color", "#000000"))
            setTextColor(Color.WHITE)
            textSize = 14f
            hint = "#000000"
            setHintTextColor(Color.GRAY)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#2D2D2D"))
                cornerRadius = 8f
            }
            setPadding(16, 16, 16, 16)
        }
        
        // Link switch checked state to disable/dim the custom Hex color box
        monetSwitch.setOnCheckedChangeListener { _, isChecked ->
            colorInput.isEnabled = !isChecked
            colorInput.alpha = if (isChecked) 0.5f else 1.0f
        }
        colorInput.isEnabled = !monetSwitch.isChecked
        colorInput.alpha = if (monetSwitch.isChecked) 0.5f else 1.0f
        
        rootLayout.addView(createCardSection("Custom Island Color (Hex)", colorInput))

        // Blacklisted Apps Section
        val blacklistInput = EditText(this).apply {
            setText(prefs.getString("blacklist_apps", "com.android.settings,com.android.keyguard"))
            setTextColor(Color.WHITE)
            textSize = 14f
            hint = "com.pkg1,com.pkg2"
            setHintTextColor(Color.GRAY)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#2D2D2D"))
                cornerRadius = 8f
            }
            setPadding(16, 16, 16, 16)
        }
        rootLayout.addView(createCardSection("Blacklisted App Package Names (Comma Separated)", blacklistInput))

        // Save Button
        val saveButton = Button(this).apply {
            text = "Save Settings"
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#10B981"))
                cornerRadius = 12f
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = 32
            }
            setOnClickListener {
                val editor = prefs.edit()
                val finalX = xSeekBar.progress - 100
                val finalY = ySeekBar.progress - 100
                val finalColor = colorInput.text.toString().trim()
                val finalBlacklist = blacklistInput.text.toString().trim()

                editor.putInt("island_x_offset", finalX)
                editor.putInt("island_y_offset", finalY)
                editor.putString("island_color", finalColor)
                editor.putBoolean("use_monet", monetSwitch.isChecked)
                editor.putBoolean("hide_on_landscape", landscapeSwitch.isChecked)
                editor.putString("blacklist_apps", finalBlacklist)
                editor.apply()

                Toast.makeText(this@SettingsActivity, "Settings Saved! No reboot required.", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
        rootLayout.addView(saveButton)

        val scrollView = ScrollView(this).apply {
            addView(rootLayout)
        }
        setContentView(scrollView)
    }
}

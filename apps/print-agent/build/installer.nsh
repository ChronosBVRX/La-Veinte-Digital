!macro customInit
  ${if} ${Silent}
    Sleep 2200
  ${endIf}
!macroend

!macro customInstall
  ${if} ${Silent}
    Exec '"$appExe"'
  ${endIf}
!macroend

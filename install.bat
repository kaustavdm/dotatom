for /D %i in (packages/*) do cd "packages/%i" & apm install & cd ..\..

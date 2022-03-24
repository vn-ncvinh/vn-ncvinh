from ctypes import sizeof
import os
dirs = os.getcwd()+'\list.txt'
files = []
def removefile(patch):
    if os.path.exists(patch):
        os.remove(patch)

def sortfile():
    list = ["Chipset", "SerialIO", "WIFI", "Graphics", "Audio", "ElevocUWP", "RtkUWP", "DTSApp", "FingerPrint"]
    temp = []
    global files
    for i in list:
        for file in files:
            if i in file:
                temp.append(file)
                continue
    for file in files:
        if file not in temp:
            temp.append(file)
    files = temp


def genfiles():
    global files
    removefile(dirs)
    os.system("dir /b >> " + dirs)
    f = open(dirs, "r")
    files = f.read().split("\n")
    f.close()
    removefile(dirs)
    arr = ["", "list.txt", "createfileinstall.py", "1Click.bat"]
    for a in arr:
        if(a in files):
            files.remove(a)
    sortfile()
    for x in range(len(files)):
        files[x] = files[x] + "\Onekeyinstall.bat"
        fileDir = os.path.dirname(os.path.realpath('__file__'))
        files[x] = os.path.join(fileDir, files[x])
        

def replance_text(filename):
    # Read in the file
    with open(filename, 'r', encoding='UTF8') as f:
        filedata = f.read()
    f.close()
    # Replace the target string
    filedata = filedata.replace('pause\n', '')

    # Write the file out again
    with open(filename, 'w', encoding='UTF8') as f:
        f.write(filedata)
    f.close()

def createfileinstall():
    
    with open("1Click.bat", 'w', encoding='UTF8') as f:
        f.write('@echo off\nnet session >nul 2>&1\nif NOT %errorLevel% == 0 echo Run as administrator && pause && exit\n')
        for file in files:
            
            f.write('start cmd /k "'+file+'"\npause\n')
            # f.write('"'+file+'"\n')


if __name__ == "__main__":
    genfiles()
    print("Replance...")
    for file in files:
        replance_text(file)
        # print(file)
    createfileinstall()
    print("Done")
    
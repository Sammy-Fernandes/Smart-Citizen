import pexpect
import sys

def main():
    print("Starting eas credentials...")
    child = pexpect.spawn('npx eas-cli credentials -p android', encoding='utf-8', timeout=15)
    child.logfile = sys.stdout

    try:
        # Wait for profile selection
        child.expect('Which build profile do you want to configure?')
        # Down to preview
        child.send('\033[B') 
        child.send('\r')
        
        # Wait for next prompt
        child.expect('.*')
        # Just loop and print everything until exit
        while True:
            try:
                # We can send another Enter if prompted
                i = child.expect(['(?i)keystore', '(?i)select', '(?i)choose', pexpect.EOF, pexpect.TIMEOUT], timeout=3)
                if i == 4:
                    print("\nTimeout waiting for more input. Sending enter just in case.")
                    child.send('\r')
                elif i == 3:
                    break
                else:
                    child.send('\r')
            except Exception as e:
                pass
    except pexpect.EOF:
        pass
    except pexpect.TIMEOUT:
        pass
    print("Done")

if __name__ == '__main__':
    main()

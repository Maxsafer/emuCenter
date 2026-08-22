$code = @"
using System;
using System.Runtime.InteropServices;

namespace FolderPicker {
    public class Dialog {
        [DllImport("shell32.dll")]
        private static extern int SHCreateItemFromParsingName([MarshalAs(UnmanagedType.LPWStr)] string pszPath, IntPtr pbc, ref Guid riid, out IntPtr ppv);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        private const string IID_IFileOpenDialog = "d57c7288-d4ad-4768-be02-9d969532d960";
        private const string IID_IShellItem = "43826d1e-e718-42ee-bc55-a1e261c37bfe";

        [ComImport]
        [Guid(IID_IFileOpenDialog)]
        [CoClass(typeof(FileOpenDialogRCW))]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IFileOpenDialog {
            void Show([In] IntPtr parent);
            void SetFileTypes([In] uint cFileTypes, [In] IntPtr rgFilterSpec);
            void SetFileTypeIndex([In] uint iFileType);
            void GetFileTypeIndex(out uint piFileType);
            void Advise([In] IntPtr pfde, out uint pdwCookie);
            void Unadvise([In] uint dwCookie);
            void SetOptions([In] uint fos);
            void GetOptions(out uint fos);
            void SetDefaultFolder([In, MarshalAs(UnmanagedType.Interface)] object psi);
            void SetFolder([In, MarshalAs(UnmanagedType.Interface)] object psi);
            void GetFolder([MarshalAs(UnmanagedType.Interface)] out object ppsi);
            void GetCurrentSelection([MarshalAs(UnmanagedType.Interface)] out object ppsi);
            void SetFileName([In, MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
            void SetTitle([In, MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
            void SetOkButtonLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszText);
            void SetFileNameLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
            void GetResult([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
            void AddPlace([In, MarshalAs(UnmanagedType.Interface)] object psi, uint fdap);
            void SetDefaultExtension([In, MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
            void Close([MarshalAs(UnmanagedType.Error)] int hr);
            void SetClientGuid([In] ref Guid guid);
            void ClearClientData();
            void SetFilter([MarshalAs(UnmanagedType.Interface)] object pFilter);
        }

        [ComImport]
        [Guid("dc1c5a9c-e88a-4dde-a5a1-60f82a20aef7")]
        [ClassInterface(ClassInterfaceType.None)]
        private class FileOpenDialogRCW { }

        [ComImport]
        [Guid(IID_IShellItem)]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IShellItem {
            void BindToHandler([In, MarshalAs(UnmanagedType.Interface)] IntPtr pbc, [In] ref Guid bhid, [In] ref Guid riid, out IntPtr ppv);
            void GetParent([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
            void GetDisplayName([In] uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
            void GetAttributes([In] uint sfgaoMask, out uint psfgaoAttribs);
            void Compare([In, MarshalAs(UnmanagedType.Interface)] IShellItem psi, [In] uint hint, out int piOrder);
        }

        public static string Show() {
            try {
                IFileOpenDialog dialog = (IFileOpenDialog)new FileOpenDialogRCW();
                
                // FOS_PICKFOLDERS = 0x20
                // FOS_FORCEFILESYSTEM = 0x40
                dialog.SetOptions(0x20 | 0x40);
                dialog.SetTitle("Select Games Directory");

                IntPtr owner = GetForegroundWindow();
                dialog.Show(owner);

                IShellItem result;
                dialog.GetResult(out result);

                string path;
                // SIGDN_FILESYSPATH = 0x80058000
                result.GetDisplayName(0x80058000, out path);
                
                return path;
            } catch {
                return null;
            }
        }
    }
}
"@

Add-Type -TypeDefinition $code
[FolderPicker.Dialog]::Show()
